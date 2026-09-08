import 'package:flutter/material.dart';
import '../models/models.dart';
import '../services/auth_service.dart';

class AuthProvider extends ChangeNotifier {
  final AuthService _authService = AuthService();
  String? _token;
  ApiUser? _user;
  bool _isLoading = false;
  String? _error;

  String? get token => _token;
  ApiUser? get user => _user;
  bool get isLoading => _isLoading;
  String? get error => _error;
  bool get isAuthenticated => _token != null && _user != null;

  Future<void> restoreSession() async {
    _token = await _authService.getToken();
    if (_token != null) {
      try {
        _user = await _authService.currentUser(_token!);
        if (_user == null) _token = null;
      } catch (_) {
        _token = null;
      }
    }
    notifyListeners();
  }

  Future<bool> login(String identifier, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      _token = await _authService.login(identifier, password);
      _user = await _authService.currentUser(_token!);
      if (_user == null) {
        _token = null;
        _error = 'Failed to load user profile';
      }
    } catch (e) {
      _token = null;
      _user = null;
      _error = e.toString().replaceFirst('Exception: ', '');
    }
    _isLoading = false;
    notifyListeners();
    return isAuthenticated;
  }

  Future<bool> register(String username, String email, String password) async {
    _isLoading = true;
    _error = null;
    notifyListeners();
    try {
      final result = await _authService.register(
        username: username,
        email: email,
        password: password,
      );
      _isLoading = false;
      notifyListeners();
      return result;
    } catch (e) {
      _error = e.toString().replaceFirst('Exception: ', '');
      _isLoading = false;
      notifyListeners();
      return false;
    }
  }

  Future<void> logout() async {
    await _authService.logout();
    _token = null;
    _user = null;
    notifyListeners();
  }
}