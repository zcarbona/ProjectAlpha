from jose import jwt
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel, EmailStr, Field, model_validator
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_, update
from sqlalchemy.future import select
from sqlalchemy.exc import IntegrityError
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token, REFRESH_TOKEN_EXPIRE_DAYS, validate_password_strength, _check_rate_limit, MAX_LOGIN_ATTEMPTS, LOCK_MINUTES, _client_ip, SECRET_KEY, ALGORITHM
from app.models.models import User, UserRole, AuditEvent, Provider, Job, VerificationCode
from app.schemas.user import UserCreate, UserOut, Token, UserUpdate
from app.core.security import get_current_user
from app.core.redis import store_pending_registration, get_pending_registration, delete_pending_registration
from datetime import datetime, timedelta
import os
import smtplib
import random
import logging

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/auth", tags=["authentication"])


def send_email(to_email: str, body: str, code: str):
    sender_email = os.getenv("EMAIL_SENDER")
    sender_password = os.getenv("APP_PASSWORD")
    if not sender_email or not sender_password:
        logger.info("[DEV/TEST] Email credentials not configured. Verification code for %s is: %s", to_email, code)
        print(f"[DEV/TEST] Verification code for {to_email}: {code}")
        return
    message = f"Subject: Verify your email address\n\n{body}\n\nYour verification code is: {code}"
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(sender_email, sender_password)
            server.sendmail(sender_email, to_email, message)
    except Exception as e:
        logger.warning("Failed to send email to %s: %s. Code: %s", to_email, e, code)
        print(f"Failed to send email: {e}. Code: {code}")


VERIFICATION_CODE_EXPIRE_MINUTES = 15


def generate_verification_code() -> str:
    return f"{random.randint(100000, 999999)}"


async def create_verification_code(db: AsyncSession, user_id: int, email: str) -> str:
    code = generate_verification_code()
    code_hash = get_password_hash(code)
    expires_at = datetime.utcnow() + timedelta(minutes=VERIFICATION_CODE_EXPIRE_MINUTES)
    db_code = VerificationCode(
        user_id=user_id,
        code_hash=code_hash,
        email=email,
        expires_at=expires_at,
    )
    db.add(db_code)
    await db.commit()
    await db.refresh(db_code)
    return code


class VerifyEmailRequest(BaseModel):
    email: str
    code: str


class ResendVerificationRequest(BaseModel):
    email: str


class RegistrationStartRequest(BaseModel):
    email: Optional[EmailStr] = None
    username: Optional[str] = Field(default=None, min_length=3, max_length=50, pattern=r"^[a-zA-Z0-9_]+$")
    phone_number: Optional[str] = Field(default=None, pattern=r"^\+?[1-9]\d{1,14}$")
    password: str = Field(min_length=12, max_length=128)
    role: UserRole

    @model_validator(mode="after")
    def has_login_identifier(self):
        if not any((self.email, self.username, self.phone_number)):
            raise ValueError(
                "email, username, or phone number is required"
            )
        return self

    @model_validator(mode="after")
    def normalize_role(self):
        if isinstance(self.role, str):
            self.role = UserRole(self.role)
        return self


class RegistrationSendCodeRequest(BaseModel):
    email: EmailStr


class RegistrationVerifyCodeRequest(BaseModel):
    email: EmailStr
    code: str


class RegistrationResendCodeRequest(BaseModel):
    email: EmailStr


@router.post("/register")
async def register(request: Request, payload: RegistrationStartRequest, db: AsyncSession = Depends(get_db)):
    identifier = payload.email or payload.username or payload.phone_number or "unknown"
    if not _check_rate_limit(f"register:{identifier}", limit=5, window_minutes=10):
        raise HTTPException(status_code=429, detail="Too many registration attempts. Please try again later.")

    try:
        validate_password_strength(payload.password)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    identifiers = []
    if payload.email:
        identifiers.append(User.email == payload.email)
    if payload.username:
        identifiers.append(User.username == payload.username)
    if payload.phone_number:
        identifiers.append(User.phone_number == payload.phone_number)
    query = select(User).where(or_(*identifiers))
    result = await db.execute(query)
    if result.scalars().first():
        raise HTTPException(
            status_code=400,
            detail="User with this email or username already exists"
        )

    pending = await get_pending_registration(str(payload.email))
    if pending:
        await delete_pending_registration(str(payload.email))

    await store_pending_registration(
        str(payload.email),
        {
            "email": payload.email,
            "username": payload.username,
            "phone_number": payload.phone_number,
            "hashed_password": get_password_hash(payload.password),
            "role": payload.role.value if hasattr(payload.role, "value") else payload.role,
        },
        "",
    )

    return {"message": "Registration data accepted. Please verify your email."}


@router.post("/register/send-code")
async def register_send_code(payload: RegistrationSendCodeRequest, request: Request, db: AsyncSession = Depends(get_db)):
    identifier = f"register_send_code:{payload.email}"
    if not _check_rate_limit(identifier, limit=5, window_minutes=10):
        raise HTTPException(status_code=429, detail="Too many requests. Please try again later.")

    pending = await get_pending_registration(str(payload.email))
    if not pending:
        raise HTTPException(status_code=404, detail="Pending registration not found. Please start registration again.")

    existing_user = (await db.execute(select(User).where(User.email == payload.email))).scalars().first()
    if existing_user:
        await delete_pending_registration(str(payload.email))
        raise HTTPException(status_code=400, detail="Email already registered")

    code = generate_verification_code()
    code_hash = get_password_hash(code)
    pending["otp_hash"] = code_hash
    await store_pending_registration(
        str(payload.email),
        pending["registration"],
        code_hash,
    )

    body = "Complete your registration by entering this verification code"
    try:
        send_email(to_email=str(payload.email), body=body, code=code)
    except RuntimeError:
        raise HTTPException(status_code=500, detail="Email service not configured")

    return {"message": "Verification code sent"}


@router.post("/register/verify-code", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register_verify_code(payload: RegistrationVerifyCodeRequest, request: Request, db: AsyncSession = Depends(get_db)):
    identifier = f"register_verify_code:{payload.email}"
    if not _check_rate_limit(identifier, limit=5, window_minutes=10):
        raise HTTPException(status_code=429, detail="Too many verification attempts. Please try again later.")

    pending = await get_pending_registration(str(payload.email))
    if not pending:
        raise HTTPException(status_code=400, detail="Pending registration not found or expired")

    if not verify_password(payload.code, pending.get("otp_hash", "")):
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    registration = pending["registration"]
    email = registration["email"]
    username = registration.get("username")
    phone_number = registration.get("phone_number")
    hashed_password = registration["hashed_password"]
    role_value = registration.get("role", "customer")
    if isinstance(role_value, str):
        role = UserRole(role_value)
    else:
        role = role_value

    identifiers = []
    if email:
        identifiers.append(User.email == email)
    if username:
        identifiers.append(User.username == username)
    if phone_number:
        identifiers.append(User.phone_number == phone_number)
    query = select(User).where(or_(*identifiers))
    result = await db.execute(query)
    if result.scalars().first():
        await delete_pending_registration(str(payload.email))
        raise HTTPException(status_code=400, detail="User with this email or username already exists")

    db_user = User(
        email=email,
        username=username,
        phone_number=phone_number,
        hashed_password=hashed_password,
        role=role,
        is_verified=True,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)

    if db_user.role == UserRole.PROVIDER:
        db.add(Provider(user_id=db_user.id, display_name=db_user.username or db_user.email or "Provider"))
    db.add(AuditEvent(actor=str(db_user.id), action="register", record_type="User", record_id=db_user.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()

    await delete_pending_registration(str(payload.email))
    return db_user


@router.post("/register/resend-code")
async def register_resend_code(payload: RegistrationResendCodeRequest, request: Request, db: AsyncSession = Depends(get_db)):
    identifier = f"register_resend_code:{payload.email}"
    if not _check_rate_limit(identifier, limit=3, window_minutes=5):
        raise HTTPException(status_code=429, detail="Too many resend attempts. Please try again later.")

    pending = await get_pending_registration(str(payload.email))
    if not pending:
        raise HTTPException(status_code=404, detail="Pending registration not found. Please start registration again.")

    existing_user = (await db.execute(select(User).where(User.email == payload.email))).scalars().first()
    if existing_user:
        await delete_pending_registration(str(payload.email))
        raise HTTPException(status_code=400, detail="Email already registered")

    code = generate_verification_code()
    code_hash = get_password_hash(code)
    await store_pending_registration(
        str(payload.email),
        pending["registration"],
        code_hash,
    )

    body = "Complete your registration by entering this verification code"
    try:
        send_email(to_email=str(payload.email), body=body, code=code)
    except RuntimeError:
        raise HTTPException(status_code=500, detail="Email service not configured")

    return {"message": "Verification code resent"}


@router.post("/login", response_model=Token)
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    client_ip = _client_ip(request)
    if not _check_rate_limit(f"login:{client_ip}", limit=10, window_minutes=1):
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again later.")

    query = select(User).where(
        (User.username == form_data.username) | (User.email == form_data.username) | (User.phone_number == form_data.username)
    )
    result = await db.execute(query)
    user = result.scalars().first()

    if user and user.locked_until and user.locked_until > datetime.utcnow():
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account locked due to too many failed attempts. Try again in {int((user.locked_until - datetime.utcnow()).total_seconds() / 60)} minutes.",
        )

    if not user or not verify_password(form_data.password, user.hashed_password):
        if user:
            user.failed_login_attempts = (user.failed_login_attempts or 0) + 1
            if user.failed_login_attempts >= MAX_LOGIN_ATTEMPTS:
                user.locked_until = datetime.utcnow() + timedelta(minutes=LOCK_MINUTES)
                db.add(AuditEvent(actor=str(user.id), action="account_locked", record_type="User", record_id=user.id, ip_address=client_ip, user_agent=request.headers.get("user-agent")))
            db.add(user)
            await db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not user.is_verified:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account not verified. Please check your email for the verification code.",
        )

    if user.failed_login_attempts:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.add(user)

    db.add(AuditEvent(actor=str(user.id), action="login", record_type="User", record_id=user.id, ip_address=client_ip, user_agent=request.headers.get("user-agent")))

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    user.refresh_token = get_password_hash(refresh_token)
    user.refresh_token_expires = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(user)

    await db.commit()
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}


@router.post("/verify-email")
async def verify_email(payload: VerifyEmailRequest, db: AsyncSession = Depends(get_db)):
    query = select(VerificationCode).where(
        VerificationCode.email == payload.email,
        VerificationCode.used_at == None,
        VerificationCode.expires_at > datetime.utcnow(),
    ).order_by(VerificationCode.created_at.desc())
    result = await db.execute(query)
    vc = result.scalars().first()

    if not vc or not verify_password(payload.code, vc.code_hash):
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")

    user = (await db.execute(select(User).where(User.id == vc.user_id))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_verified = True
    vc.used_at = datetime.utcnow()
    db.add(user)
    db.add(vc)
    await db.commit()
    return {"message": "Email verified successfully"}


@router.post("/resend-verification")
async def resend_verification(payload: ResendVerificationRequest, request: Request, db: AsyncSession = Depends(get_db)):
    identifier = f"resend:{payload.email}"
    if not _check_rate_limit(identifier, limit=3, window_minutes=5):
        raise HTTPException(status_code=429, detail="Too many resend attempts. Please try again later.")

    user = (await db.execute(select(User).where(User.email == payload.email))).scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if user.is_verified:
        raise HTTPException(status_code=400, detail="Email already verified")

    code = await create_verification_code(db, user.id, user.email)
    body = f"Please verify your email address for account {user.username or user.email}"
    try:
        send_email(to_email=user.email, body=body, code=code)
    except RuntimeError:
        raise HTTPException(status_code=500, detail="Email service not configured")

    return {"message": "Verification email sent"}


@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user


@router.patch("/me", response_model=UserOut)
async def update_me(payload: UserUpdate, request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    update_data = payload.model_dump(exclude_unset=True)

    if "phone_number" in update_data and payload.phone_number and payload.phone_number != user.phone_number:
        query = select(User).where(User.phone_number == payload.phone_number, User.id != user.id)
        existing = (await db.execute(query)).scalars().first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Phone number already in use")

    if "email" in update_data and payload.email and payload.email != user.email:
        query = select(User).where(User.email == payload.email, User.id != user.id)
        existing = (await db.execute(query)).scalars().first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already in use")

    if "username" in update_data and payload.username and payload.username != user.username:
        query = select(User).where(User.username == payload.username, User.id != user.id)
        existing = (await db.execute(query)).scalars().first()
        if existing:
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username already in use")

    for field in ("email", "username", "phone_number"):
        if field in update_data:
            setattr(user, field, update_data[field])

    if "password" in update_data and payload.password:
        try:
            validate_password_strength(payload.password)
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(e))
        user.hashed_password = get_password_hash(payload.password)

    db.add(AuditEvent(actor=str(user.id), action="update_profile", record_type="User", record_id=user.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="A user with these details already exists")

    await db.refresh(user)
    return user


class RefreshRequest(BaseModel):
    refresh_token: str


@router.post("/refresh", response_model=Token)
async def refresh(payload: RefreshRequest, db: AsyncSession = Depends(get_db)):
    try:
        payload_data = jwt.decode(payload.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        if payload_data.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = int(payload_data.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    user = (await db.execute(select(User).where(User.id == user_id))).scalars().first()
    if not user or not user.refresh_token or not verify_password(payload.refresh_token, user.refresh_token) or (user.refresh_token_expires and user.refresh_token_expires < datetime.utcnow()):
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")

    access_token = create_access_token(subject=user.id)
    refresh_token = create_refresh_token(subject=user.id)

    user.refresh_token = get_password_hash(refresh_token)
    user.refresh_token_expires = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    db.add(user)
    await db.commit()

    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}
