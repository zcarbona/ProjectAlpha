import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'models/models.dart';
import 'theme/app_theme.dart';
import 'screens/user/book_flow_screen.dart';
import 'screens/user/trip_screen.dart';
import 'screens/user/chat_screen.dart';
import 'screens/user/profile_screen.dart';
import 'screens/auth/auth_screen.dart';
import 'screens/admin/admin_panel_screen.dart';
import 'providers/auth_provider.dart' as app_auth;

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
    statusBarColor: Colors.transparent,
    statusBarIconBrightness: Brightness.dark,
  ));
  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => app_auth.AuthProvider()),
      ],
      child: const NaqlApp(),
    ),
  );
}

class NaqlApp extends StatelessWidget {
  const NaqlApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Naql',
      debugShowCheckedModeBanner: false,
      theme: userTheme(),
      home: const AuthGate(),
    );
  }
}

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _restoring = true;

  @override
  void initState() {
    super.initState();
    Future(() async {
      await context.read<app_auth.AuthProvider>().restoreSession();
      if (mounted) setState(() => _restoring = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_restoring) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    return context.watch<app_auth.AuthProvider>().isAuthenticated
        ? const AppShell()
        : const AuthScreen();
  }
}

enum UserTab { book, trip, chat, profile }

class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> {
  final AppMode mode = AppMode.user;
  UserTab userTab = UserTab.book;
  bool bookCompleted = false;

  bool get isUser => mode == AppMode.user;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      color: isUser ? kUserBg : kAdminBg,
      child: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: AnimatedSwitcher(
                duration: const Duration(milliseconds: 250),
                child: _buildUserBody(),
              ),
            ),
            if (isUser) _buildUserNav(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 400),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: isUser ? kUserSurface : kAdminBg,
        border: Border(
          bottom: BorderSide(
            color: isUser ? const Color(0xFFF3F4F6) : kAdminBorder,
          ),
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: kGreen,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Center(
              child: Text(
                'N',
                style: outfitStyle(size: 16, weight: FontWeight.w800, color: Colors.white),
              ),
            ),
          ),
          const SizedBox(width: 10),
          RichText(
            text: TextSpan(
              children: [
                TextSpan(
                  text: 'Naql',
                  style: outfitStyle(
                    size: 18,
                    weight: FontWeight.w700,
                    color: isUser ? kUserText : kAdminText,
                  ),
                ),
                TextSpan(
                  text: '.',
                  style: outfitStyle(size: 18, weight: FontWeight.w800, color: kGreen),
                ),
              ],
            ),
          ),
          const Spacer(),
          Text('Customer', style: outfitStyle(size: 11, weight: FontWeight.w700, color: kUserMuted)),
          const SizedBox(width: 10),
          GestureDetector(
            onTap: () {},
            child: Container(
              width: 32,
              height: 32,
              decoration: const BoxDecoration(
                color: kUserSubtle,
                shape: BoxShape.circle,
              ),
              child: const Center(
                child: Text('🔔', style: TextStyle(fontSize: 14)),
              ),
            ),
          ),
          const SizedBox(width: 8),
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: kGreenLight,
              shape: BoxShape.circle,
              border: Border.all(color: kGreenBorder, width: 1.5),
            ),
            child: Center(
              child: Text(
                'MS',
                style: outfitStyle(
                  size: 10,
                  weight: FontWeight.w700,
                  color: kGreen,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildUserBody() {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 200),
      child: _userTabContent(),
    );
  }

  Widget _userTabContent() {
    Widget content;
    switch (userTab) {
      case UserTab.book:
        content = bookCompleted
            ? const TripScreen()
            : BookFlowScreen(
                onDone: () => setState(() {
                  bookCompleted = true;
                  userTab = UserTab.trip;
                }),
              );
        break;
      case UserTab.trip:
        content = const TripScreen();
        break;
      case UserTab.chat:
        content = const ChatScreen();
        break;
      case UserTab.profile:
        content = const ProfileScreen();
        break;
    }

    return Container(
      key: ValueKey(userTab),
      color: kUserBg,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 0),
        child: content,
      ),
    );
  }

  static const _navItems = [
    _NavItem(tab: UserTab.book, emoji: '🚛', label: 'BOOK'),
    _NavItem(tab: UserTab.trip, emoji: '📍', label: 'MY TRIP'),
    _NavItem(tab: UserTab.chat, emoji: '💬', label: 'CHAT'),
    _NavItem(tab: UserTab.profile, emoji: '👤', label: 'PROFILE'),
  ];

  Widget _buildUserNav() {
    return Container(
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 16),
      decoration: const BoxDecoration(
        color: kUserSurface,
        border: Border(top: BorderSide(color: Color(0xFFF3F4F6))),
      ),
      child: Row(
        children: _navItems.map((item) {
          final isActive = userTab == item.tab;
          return Expanded(
            child: GestureDetector(
              onTap: () => setState(() => userTab = item.tab),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                padding: const EdgeInsets.symmetric(vertical: 8),
                decoration: BoxDecoration(
                  color: isActive ? kGreen.withOpacity(0.08) : Colors.transparent,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    AnimatedScale(
                      scale: isActive ? 1.15 : 1.0,
                      duration: const Duration(milliseconds: 150),
                      child: Text(item.emoji, style: const TextStyle(fontSize: 20)),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      item.label,
                      style: outfitStyle(
                        size: 9,
                        weight: FontWeight.w700,
                        color: isActive ? kGreen : kUserMuted,
                        letterSpacing: 0.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _NavItem {
  final UserTab tab;
  final String emoji;
  final String label;
  const _NavItem({required this.tab, required this.emoji, required this.label});
}