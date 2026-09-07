import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/models.dart';

class AuthService {
  static const String baseUrl = '/api/v1';
  final _storage = const FlutterSecureStorage();

  Future<String?> login(String identifier, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      body: {'username': identifier, 'password': password},
    );
    if (response.statusCode != 200) return null;
    final token = (json.decode(response.body) as Map<String, dynamic>)['access_token'] as String;
    await _storage.write(key: 'jwt', value: token);
    return token;
  }

  Future<bool> register({
    required String username,
    required String email,
    required String password,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'username': username, 'email': email, 'password': password}),
    );
    return response.statusCode == 201;
  }

  Future<ApiUser?> currentUser(String token) async {
    final response = await http.get(
      Uri.parse('$baseUrl/auth/me'),
      headers: {'Authorization': 'Bearer $token'},
    );
    return response.statusCode == 200
        ? ApiUser.fromJson(json.decode(response.body) as Map<String, dynamic>)
        : null;
  }

  Future<String?> getToken() => _storage.read(key: 'jwt');
  Future<void> logout() => _storage.delete(key: 'jwt');
}