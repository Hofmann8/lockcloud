import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:lockcloud/core/storage/secure_storage.dart';
import 'package:mocktail/mocktail.dart';

// Mock class for FlutterSecureStorage
class MockFlutterSecureStorage extends Mock implements FlutterSecureStorage {}

void main() {
  late MockFlutterSecureStorage mockStorage;
  late SecureStorage secureStorage;

  setUp(() {
    mockStorage = MockFlutterSecureStorage();
    secureStorage = SecureStorage(storage: mockStorage);
  });

  group('SecureStorage', () {
    group('JWT Token Operations', () {
      test('getToken returns token when it exists', () async {
        // Arrange
        when(() => mockStorage.read(key: 'jwt_token'))
            .thenAnswer((_) async => 'test_token');

        // Act
        final result = await secureStorage.getToken();

        // Assert
        expect(result, equals('test_token'));
        verify(() => mockStorage.read(key: 'jwt_token')).called(1);
      });

      test('getToken returns null when token does not exist', () async {
        // Arrange
        when(() => mockStorage.read(key: 'jwt_token'))
            .thenAnswer((_) async => null);

        // Act
        final result = await secureStorage.getToken();

        // Assert
        expect(result, isNull);
      });

      test('getToken returns null on storage error', () async {
        // Arrange
        when(() => mockStorage.read(key: 'jwt_token'))
            .thenThrow(Exception('Storage error'));

        // Act
        final result = await secureStorage.getToken();

        // Assert
        expect(result, isNull);
      });

      test('saveToken stores token successfully', () async {
        // Arrange
        when(() => mockStorage.write(key: 'jwt_token', value: 'test_token'))
            .thenAnswer((_) async {});
        when(() => mockStorage.write(
                key: 'token_expiration', value: any(named: 'value')))
            .thenAnswer((_) async {});

        // Act
        await secureStorage.saveToken('test_token');

        // Assert
        verify(() => mockStorage.write(key: 'jwt_token', value: 'test_token'))
            .called(1);
      });

      test('saveToken extracts and stores expiration from valid JWT', () async {
        // Create a valid JWT with exp claim
        final payload = {
          'sub': '1234567890',
          'name': 'Test User',
          'exp': DateTime.now()
                  .add(const Duration(hours: 1))
                  .millisecondsSinceEpoch ~/
              1000,
        };
        final payloadBase64 =
            base64Url.encode(utf8.encode(json.encode(payload)));
        final token = 'header.$payloadBase64.signature';

        when(() => mockStorage.write(key: 'jwt_token', value: token))
            .thenAnswer((_) async {});
        when(() => mockStorage.write(
                key: 'token_expiration', value: any(named: 'value')))
            .thenAnswer((_) async {});

        // Act
        await secureStorage.saveToken(token);

        // Assert
        verify(() => mockStorage.write(key: 'jwt_token', value: token))
            .called(1);
        verify(() => mockStorage.write(
            key: 'token_expiration', value: any(named: 'value'))).called(1);
      });

      test('setToken is an alias for saveToken', () async {
        // Arrange
        when(() => mockStorage.write(key: 'jwt_token', value: 'test_token'))
            .thenAnswer((_) async {});
        when(() => mockStorage.write(
                key: 'token_expiration', value: any(named: 'value')))
            .thenAnswer((_) async {});

        // Act
        await secureStorage.setToken('test_token');

        // Assert
        verify(() => mockStorage.write(key: 'jwt_token', value: 'test_token'))
            .called(1);
      });

      test('deleteToken removes token and expiration', () async {
        // Arrange
        when(() => mockStorage.delete(key: 'jwt_token'))
            .thenAnswer((_) async {});
        when(() => mockStorage.delete(key: 'token_expiration'))
            .thenAnswer((_) async {});

        // Act
        await secureStorage.deleteToken();

        // Assert
        verify(() => mockStorage.delete(key: 'jwt_token')).called(1);
        verify(() => mockStorage.delete(key: 'token_expiration')).called(1);
      });

      test('saveToken throws SecureStorageException on error', () async {
        // Arrange
        when(() => mockStorage.write(key: 'jwt_token', value: 'test_token'))
            .thenThrow(Exception('Write error'));

        // Act & Assert
        expect(
          () => secureStorage.saveToken('test_token'),
          throwsA(isA<SecureStorageException>()),
        );
      });
    });

    group('Refresh Token Operations', () {
      test('getRefreshToken returns token when it exists', () async {
        // Arrange
        when(() => mockStorage.read(key: 'refresh_token'))
            .thenAnswer((_) async => 'refresh_test_token');

        // Act
        final result = await secureStorage.getRefreshToken();

        // Assert
        expect(result, equals('refresh_test_token'));
      });

      test('saveRefreshToken stores token successfully', () async {
        // Arrange
        when(() =>
                mockStorage.write(key: 'refresh_token', value: 'refresh_token'))
            .thenAnswer((_) async {});

        // Act
        await secureStorage.saveRefreshToken('refresh_token');

        // Assert
        verify(() =>
                mockStorage.write(key: 'refresh_token', value: 'refresh_token'))
            .called(1);
      });

      test('deleteRefreshToken removes token', () async {
        // Arrange
        when(() => mockStorage.delete(key: 'refresh_token'))
            .thenAnswer((_) async {});

        // Act
        await secureStorage.deleteRefreshToken();

        // Assert
        verify(() => mockStorage.delete(key: 'refresh_token')).called(1);
      });
    });

    group('User Info Operations', () {
      test('getUserInfo returns user info when it exists', () async {
        // Arrange
        final userInfo = {'id': 1, 'name': 'Test User', 'email': 'test@test.com'};
        when(() => mockStorage.read(key: 'user_info'))
            .thenAnswer((_) async => json.encode(userInfo));

        // Act
        final result = await secureStorage.getUserInfo();

        // Assert
        expect(result, equals(userInfo));
      });

      test('getUserInfo returns null when no user info exists', () async {
        // Arrange
        when(() => mockStorage.read(key: 'user_info'))
            .thenAnswer((_) async => null);

        // Act
        final result = await secureStorage.getUserInfo();

        // Assert
        expect(result, isNull);
      });

      test('getUserInfo returns null on invalid JSON', () async {
        // Arrange
        when(() => mockStorage.read(key: 'user_info'))
            .thenAnswer((_) async => 'invalid json');

        // Act
        final result = await secureStorage.getUserInfo();

        // Assert
        expect(result, isNull);
      });

      test('saveUserInfo stores user info as JSON', () async {
        // Arrange
        final userInfo = {'id': 1, 'name': 'Test User'};
        when(() => mockStorage.write(
                key: 'user_info', value: json.encode(userInfo)))
            .thenAnswer((_) async {});

        // Act
        await secureStorage.saveUserInfo(userInfo);

        // Assert
        verify(() => mockStorage.write(
            key: 'user_info', value: json.encode(userInfo))).called(1);
      });

      test('deleteUserInfo removes user info', () async {
        // Arrange
        when(() => mockStorage.delete(key: 'user_info'))
            .thenAnswer((_) async {});

        // Act
        await secureStorage.deleteUserInfo();

        // Assert
        verify(() => mockStorage.delete(key: 'user_info')).called(1);
      });
    });

    group('Token Expiration', () {
      test('isTokenExpired returns true when no token exists', () async {
        // Arrange
        when(() => mockStorage.read(key: 'token_expiration'))
            .thenAnswer((_) async => null);
        when(() => mockStorage.read(key: 'jwt_token'))
            .thenAnswer((_) async => null);

        // Act
        final result = await secureStorage.isTokenExpired();

        // Assert
        expect(result, isTrue);
      });

      test('isTokenExpired returns true when token is expired', () async {
        // Arrange - set expiration to 1 hour ago
        final expiredTime =
            DateTime.now().subtract(const Duration(hours: 1)).millisecondsSinceEpoch;
        when(() => mockStorage.read(key: 'token_expiration'))
            .thenAnswer((_) async => expiredTime.toString());

        // Act
        final result = await secureStorage.isTokenExpired();

        // Assert
        expect(result, isTrue);
      });

      test('isTokenExpired returns false when token is valid', () async {
        // Arrange - set expiration to 1 hour from now
        final validTime =
            DateTime.now().add(const Duration(hours: 1)).millisecondsSinceEpoch;
        when(() => mockStorage.read(key: 'token_expiration'))
            .thenAnswer((_) async => validTime.toString());

        // Act
        final result = await secureStorage.isTokenExpired();

        // Assert
        expect(result, isFalse);
      });

      test('isTokenExpiringSoon returns true when token expires within threshold',
          () async {
        // Arrange - set expiration to 3 minutes from now (within default 5 min threshold)
        final soonTime =
            DateTime.now().add(const Duration(minutes: 3)).millisecondsSinceEpoch;
        when(() => mockStorage.read(key: 'token_expiration'))
            .thenAnswer((_) async => soonTime.toString());

        // Act
        final result = await secureStorage.isTokenExpiringSoon();

        // Assert
        expect(result, isTrue);
      });

      test('isTokenExpiringSoon returns false when token has plenty of time',
          () async {
        // Arrange - set expiration to 1 hour from now
        final laterTime =
            DateTime.now().add(const Duration(hours: 1)).millisecondsSinceEpoch;
        when(() => mockStorage.read(key: 'token_expiration'))
            .thenAnswer((_) async => laterTime.toString());

        // Act
        final result = await secureStorage.isTokenExpiringSoon();

        // Assert
        expect(result, isFalse);
      });

      test('getTokenExpiration returns expiration DateTime', () async {
        // Arrange
        final expirationTime =
            DateTime.now().add(const Duration(hours: 1)).millisecondsSinceEpoch;
        when(() => mockStorage.read(key: 'token_expiration'))
            .thenAnswer((_) async => expirationTime.toString());

        // Act
        final result = await secureStorage.getTokenExpiration();

        // Assert
        expect(result, isNotNull);
        expect(
            result!.millisecondsSinceEpoch, equals(expirationTime));
      });
    });

    group('Login Status', () {
      test('hasToken returns true when token exists', () async {
        // Arrange
        when(() => mockStorage.read(key: 'jwt_token'))
            .thenAnswer((_) async => 'valid_token');

        // Act
        final result = await secureStorage.hasToken();

        // Assert
        expect(result, isTrue);
      });

      test('hasToken returns false when token is empty', () async {
        // Arrange
        when(() => mockStorage.read(key: 'jwt_token'))
            .thenAnswer((_) async => '');

        // Act
        final result = await secureStorage.hasToken();

        // Assert
        expect(result, isFalse);
      });

      test('hasToken returns false when token is null', () async {
        // Arrange
        when(() => mockStorage.read(key: 'jwt_token'))
            .thenAnswer((_) async => null);

        // Act
        final result = await secureStorage.hasToken();

        // Assert
        expect(result, isFalse);
      });

      test('isLoggedIn returns true when token exists and is not expired',
          () async {
        // Arrange
        when(() => mockStorage.read(key: 'jwt_token'))
            .thenAnswer((_) async => 'valid_token');
        final validTime =
            DateTime.now().add(const Duration(hours: 1)).millisecondsSinceEpoch;
        when(() => mockStorage.read(key: 'token_expiration'))
            .thenAnswer((_) async => validTime.toString());

        // Act
        final result = await secureStorage.isLoggedIn();

        // Assert
        expect(result, isTrue);
      });

      test('isLoggedIn returns false when token does not exist', () async {
        // Arrange
        when(() => mockStorage.read(key: 'jwt_token'))
            .thenAnswer((_) async => null);

        // Act
        final result = await secureStorage.isLoggedIn();

        // Assert
        expect(result, isFalse);
      });

      test('isLoggedIn returns false when token is expired', () async {
        // Arrange
        when(() => mockStorage.read(key: 'jwt_token'))
            .thenAnswer((_) async => 'expired_token');
        final expiredTime =
            DateTime.now().subtract(const Duration(hours: 1)).millisecondsSinceEpoch;
        when(() => mockStorage.read(key: 'token_expiration'))
            .thenAnswer((_) async => expiredTime.toString());

        // Act
        final result = await secureStorage.isLoggedIn();

        // Assert
        expect(result, isFalse);
      });
    });

    group('Clear Operations', () {
      test('clearAll deletes all storage data', () async {
        // Arrange
        when(() => mockStorage.deleteAll()).thenAnswer((_) async {});

        // Act
        await secureStorage.clearAll();

        // Assert
        verify(() => mockStorage.deleteAll()).called(1);
      });

      test('clearAuthData deletes only auth-related data', () async {
        // Arrange
        when(() => mockStorage.delete(key: 'jwt_token'))
            .thenAnswer((_) async {});
        when(() => mockStorage.delete(key: 'refresh_token'))
            .thenAnswer((_) async {});
        when(() => mockStorage.delete(key: 'user_info'))
            .thenAnswer((_) async {});
        when(() => mockStorage.delete(key: 'token_expiration'))
            .thenAnswer((_) async {});

        // Act
        await secureStorage.clearAuthData();

        // Assert
        verify(() => mockStorage.delete(key: 'jwt_token')).called(1);
        verify(() => mockStorage.delete(key: 'refresh_token')).called(1);
        verify(() => mockStorage.delete(key: 'user_info')).called(1);
        verify(() => mockStorage.delete(key: 'token_expiration')).called(1);
      });

      test('clearAll throws SecureStorageException on error', () async {
        // Arrange
        when(() => mockStorage.deleteAll())
            .thenThrow(Exception('Delete error'));

        // Act & Assert
        expect(
          () => secureStorage.clearAll(),
          throwsA(isA<SecureStorageException>()),
        );
      });
    });

    group('JWT Token Parsing', () {
      test('extracts expiration from valid JWT token', () async {
        // Create a valid JWT with exp claim
        final expTime = DateTime.now().add(const Duration(hours: 1));
        final payload = {
          'sub': '1234567890',
          'name': 'Test User',
          'exp': expTime.millisecondsSinceEpoch ~/ 1000,
        };
        final payloadBase64 =
            base64Url.encode(utf8.encode(json.encode(payload)));
        final token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.$payloadBase64.signature';

        when(() => mockStorage.write(key: 'jwt_token', value: token))
            .thenAnswer((_) async {});
        when(() => mockStorage.write(
                key: 'token_expiration', value: any(named: 'value')))
            .thenAnswer((_) async {});

        // Act
        await secureStorage.saveToken(token);

        // Assert - verify expiration was stored
        verify(() => mockStorage.write(
            key: 'token_expiration', value: any(named: 'value'))).called(1);
      });

      test('handles JWT token without exp claim', () async {
        // Create a JWT without exp claim
        final payload = {
          'sub': '1234567890',
          'name': 'Test User',
        };
        final payloadBase64 =
            base64Url.encode(utf8.encode(json.encode(payload)));
        final token = 'header.$payloadBase64.signature';

        when(() => mockStorage.write(key: 'jwt_token', value: token))
            .thenAnswer((_) async {});

        // Act
        await secureStorage.saveToken(token);

        // Assert - token was saved but no expiration
        verify(() => mockStorage.write(key: 'jwt_token', value: token))
            .called(1);
        verifyNever(() => mockStorage.write(
            key: 'token_expiration', value: any(named: 'value')));
      });

      test('handles invalid JWT token format', () async {
        // Invalid token (not 3 parts)
        const token = 'invalid_token';

        when(() => mockStorage.write(key: 'jwt_token', value: token))
            .thenAnswer((_) async {});

        // Act
        await secureStorage.saveToken(token);

        // Assert - token was saved but no expiration
        verify(() => mockStorage.write(key: 'jwt_token', value: token))
            .called(1);
        verifyNever(() => mockStorage.write(
            key: 'token_expiration', value: any(named: 'value')));
      });
    });
  });

  group('SecureStorageException', () {
    test('toString returns formatted message', () {
      final exception = SecureStorageException('Test error');
      expect(exception.toString(), equals('SecureStorageException: Test error'));
    });
  });
}
