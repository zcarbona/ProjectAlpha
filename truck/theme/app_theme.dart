import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

const Color kUserBg = Color(0xFFF0F2F5);
const Color kUserSurface = Color(0xFFFFFFFF);
const Color kUserBorder = Color(0xFFE5E7EB);
const Color kUserSubtle = Color(0xFFF3F4F6);
const Color kUserMuted = Color(0xFF9CA3AF);
const Color kUserText = Color(0xFF111827);
const Color kUserTextSub = Color(0xFF6B7280);
const Color kGreen = Color(0xFF10B981);
const Color kGreenLight = Color(0xFFD1FAE5);
const Color kGreenBorder = Color(0xFFA7F3D0);
const Color kAmber = Color(0xFFF59E0B);
const Color kAmberLight = Color(0xFFFEF3C7);
const Color kBlue = Color(0xFF3B82F6);
const Color kBlueLight = Color(0xFFEFF6FF);

const Color kAdminBg = Color(0xFF07090F);
const Color kAdminSurface = Color(0xFF0F1320);
const Color kAdminSecondary = Color(0xFF1A2238);
const Color kAdminMuted = Color(0xFF141929);
const Color kAdminText = Color(0xFFF0F2F7);
const Color kAdminSub = Color(0xFFA8B4CC);
const Color kAdminFaint = Color(0xFF6B7A99);
const Color kAdminBorder = Color(0x12FFFFFF);
const Color kTeal = Color(0xFF00D4A0);
const Color kAdminAmber = Color(0xFFF59E0B);

TextStyle outfitStyle({
  double size = 14,
  FontWeight weight = FontWeight.w400,
  Color color = kUserText,
  double? height,
  double letterSpacing = 0,
}) =>
    GoogleFonts.outfit(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
      letterSpacing: letterSpacing,
    );

TextStyle interStyle({
  double size = 14,
  FontWeight weight = FontWeight.w400,
  Color color = kUserText,
  double? height,
}) =>
    GoogleFonts.inter(
      fontSize: size,
      fontWeight: weight,
      color: color,
      height: height,
    );

TextStyle monoStyle({
  double size = 12,
  FontWeight weight = FontWeight.w400,
  Color color = kAdminFaint,
  double letterSpacing = 0.5,
}) =>
    GoogleFonts.jetBrainsMono(
      fontSize: size,
      fontWeight: weight,
      color: color,
      letterSpacing: letterSpacing,
    );

ThemeData userTheme() => ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: kUserBg,
      colorScheme: const ColorScheme.light(
        primary: kGreen,
        surface: kUserSurface,
      ),
      textTheme: GoogleFonts.interTextTheme(),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: kGreen,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          elevation: 0,
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: kGreen,
          side: const BorderSide(color: kGreenBorder),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        ),
      ),
    );

ThemeData adminTheme() => ThemeData(
      useMaterial3: true,
      scaffoldBackgroundColor: kAdminBg,
      colorScheme: const ColorScheme.dark(
        primary: kTeal,
        surface: kAdminSurface,
      ),
      textTheme: GoogleFonts.interTextTheme(ThemeData.dark().textTheme),
      inputDecorationTheme: InputDecorationTheme(
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );