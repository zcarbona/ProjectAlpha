from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import or_
from sqlalchemy.future import select
from app.core.database import get_db
from app.core.security import get_password_hash, verify_password, create_access_token, validate_password_strength, _check_rate_limit, MAX_LOGIN_ATTEMPTS, LOCK_MINUTES, _client_ip
from app.models.models import User, UserRole, AuditEvent, Provider
from app.schemas.user import UserCreate, UserOut, Token, UserUpdate
from app.core.security import get_current_user
from datetime import datetime, timedelta

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register", response_model=UserOut, status_code=status.HTTP_201_CREATED)
async def register(
    request: Request,
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db)
):    # Rate limit by identifier (email/username/phone)
    identifier = user_in.email or user_in.username or user_in.phone_number or "unknown"
    if not _check_rate_limit(f"register:{identifier}", limit=5, window_minutes=10):
        raise HTTPException(status_code=429, detail="Too many registration attempts. Please try again later.")

    # Validate password strength
    try:
        validate_password_strength(user_in.password)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))

    # Check if user exists
    identifiers = []
    if user_in.email:
        identifiers.append(User.email == user_in.email)
    if user_in.username:
        identifiers.append(User.username == user_in.username)
    if user_in.phone_number:
        identifiers.append(User.phone_number == user_in.phone_number)
    query = select(User).where(or_(*identifiers))
    result = await db.execute(query)
    if result.scalars().first():
        raise HTTPException(
            status_code=400,
            detail="User with this email or username already exists"
        )

    # Create user
    hashed_pw = get_password_hash(user_in.password)
    role = user_in.role
    if isinstance(role, str):
        role = UserRole(role)
    db_user = User(
        email=user_in.email,
        username=user_in.username,
        phone_number=user_in.phone_number,
        hashed_password=hashed_pw,
        role=role,
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    if db_user.role == UserRole.PROVIDER:
        db.add(Provider(user_id=db_user.id, display_name=db_user.username or db_user.email or "Provider"))
    db.add(AuditEvent(actor=str(db_user.id), action="register", record_type="User", record_id=db_user.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    return db_user

@router.post("/login", response_model=Token)
async def login(request: Request, form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    # Rate limit by IP
    client_ip = _client_ip(request)
    if not _check_rate_limit(f"login:{client_ip}", limit=10, window_minutes=1):
        raise HTTPException(status_code=429, detail="Too many login attempts. Please try again later.")

    # Authenticate user (using username field for email or username)
    query = select(User).where(
        (User.username == form_data.username) | (User.email == form_data.username) | (User.phone_number == form_data.username)
    )
    result = await db.execute(query)
    user = result.scalars().first()

    # Check account lockout
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

    # Reset failed attempts on successful login
    if user.failed_login_attempts:
        user.failed_login_attempts = 0
        user.locked_until = None
        db.add(user)

    db.add(AuditEvent(actor=str(user.id), action="login", record_type="User", record_id=user.id, ip_address=client_ip, user_agent=request.headers.get("user-agent")))
    await db.commit()
    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserOut)
async def me(user: User = Depends(get_current_user)):
    return user

@router.get("/me/stats")
async def me_stats(user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    jobs = (await db.execute(select(Job).where(Job.customer_id == user.id))).scalars().all()
    return {
        "trips": len(jobs),
        "rating": 4.9,
        "savedEGP": 2340,
    }

@router.patch("/me", response_model=UserOut)
async def update_me(payload: UserUpdate, request: Request, user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    # Role changes require an administrator-only workflow and are not accepted here.
    for field in ("email", "username", "phone_number"):
        value = getattr(payload, field)
        if value is not None:
            setattr(user, field, value)
    if payload.password:
        try:
            validate_password_strength(payload.password)
        except ValueError as e:
            raise HTTPException(status_code=422, detail=str(e))
        user.hashed_password = get_password_hash(payload.password)
    db.add(AuditEvent(actor=str(user.id), action="update_profile", record_type="User", record_id=user.id, ip_address=_client_ip(request), user_agent=request.headers.get("user-agent")))
    await db.commit()
    await db.refresh(user)
    return user
