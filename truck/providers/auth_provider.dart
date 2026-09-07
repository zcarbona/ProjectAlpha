import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();
  String? _token;
  ApiUser? _user;
  bool _isLoading = false;

  String? get token => _token;
  ApiUser? get user => _user;
  bool get isLoading => _isLoading;
  bool get isAuthenticated => _token != null && _user != null;

  Future<void> restoreSession() async {
    _token = await _authService.getToken();
    if (_token != null) {
      _user = await _authService.currentUser(_token!);
      if (_user == null) _token = null;
    }
    notifyListeners();
  }

  Future<bool> login(String identifier, String password) async {
    _isLoading = true;
    notifyListeners();
    _token = await _authService.login(identifier, password);
    _user = _token == null ? null : await _authService.currentUser(_token!);
    if (_user == null) _token = null;
    _isLoading = false;
    notifyListeners();
    return isAuthenticated;
  }

  Future<bool> register(String username, String email, String password) async {
    _isLoading = true;
    notifyListeners();
    final result = await _authService.register(
      username: username,
      email: email,
      password: password,
    );
    _isLoading = false;
    notifyListeners();
    return result;
  }

  Future<void> logout() async {
    await _authService.logout();
    _token = null;
    _user = null;
    notifyListeners();
  }
}