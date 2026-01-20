import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import FirebaseService from '../services/FirebaseService';
import LocalStorage from '../storage/LocalStorage';

export default function AuthScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please enter both email and password');
      return;
    }

    try {
      setLoading(true);
      console.log('🔥 Signing in with Firebase...');
      
      // Sign in with Firebase
      const user = await FirebaseService.signIn(email.trim(), password);
      
      // Save user to local storage
      await LocalStorage.saveUser(user);
      
      // Call parent onLogin
      await onLogin(email.trim(), password, false);
      
      console.log('✅ Firebase login successful');
    } catch (error) {
      console.error('❌ Login failed:', error);
      Alert.alert(
        'Login Failed',
        error.message || 'Invalid credentials. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !name.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      console.log('🔥 Creating account with Firebase...');
      
      // Sign up with Firebase
      const user = await FirebaseService.signUp(email.trim(), password, name.trim());
      
      // Save user to local storage
      await LocalStorage.saveUser(user);
      
      // Call parent onLogin
      await onLogin(email.trim(), password, false);
      
      console.log('✅ Firebase signup successful');
      Alert.alert('Success', 'Account created successfully!');
    } catch (error) {
      console.error('❌ Signup failed:', error);
      Alert.alert(
        'Sign Up Failed',
        error.message || 'Could not create account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Mock login for testing without backend
  const handleMockLogin = async () => {
    try {
      setLoading(true);
      console.log('🧪 Mock login started');
      
      const mockUser = {
        id: 'mock-user-123',
        email: 'test@replaceplace.com',
        name: 'Test User',
      };
      
      // Save user to local storage
      await LocalStorage.saveUser(mockUser);
      console.log('✅ Mock user saved to storage');
      
      // Call onLogin with special mock flag
      await onLogin(mockUser.email, 'mock-password', true);
      
      console.log('✅ Mock login successful');
    } catch (error) {
      console.error('❌ Mock login failed:', error);
      Alert.alert('Error', 'Could not perform mock login: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>ReplacePlace</Text>
      <Text style={styles.subtitle}>Audio-Guided Story Journey</Text>
      
      <View style={styles.form}>
        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="Full Name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            editable={!loading}
          />
        )}
        
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={!loading}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          editable={!loading}
        />
        
        <TouchableOpacity
          style={[styles.button, loading && styles.buttonDisabled]}
          onPress={isSignUp ? handleSignUp : handleLogin}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>
              {isSignUp ? 'Create Account' : 'Sign In'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setIsSignUp(!isSignUp)}
          disabled={loading}
        >
          <Text style={styles.toggleText}>
            {isSignUp 
              ? 'Already have an account? Sign In' 
              : "Don't have an account? Sign Up"}
          </Text>
        </TouchableOpacity>

        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>OR</Text>
          <View style={styles.dividerLine} />
        </View>

        <TouchableOpacity
          style={[styles.button, styles.mockButton, loading && styles.buttonDisabled]}
          onPress={handleMockLogin}
          disabled={loading}
        >
          <Text style={styles.buttonText}>🧪 Test with Mock User</Text>
        </TouchableOpacity>
      </View>
      
      <Text style={styles.note}>
        🔥 Firebase Authentication enabled!{'\n'}
        Create an account or use "Test with Mock User" for quick testing.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#2196f3',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    color: '#666',
    marginBottom: 40,
  },
  form: {
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 15,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#fff',
  },
  button: {
    backgroundColor: '#2196f3',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  mockButton: {
    backgroundColor: '#ff9800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  toggleButton: {
    marginTop: 15,
    padding: 10,
    alignItems: 'center',
  },
  toggleText: {
    color: '#2196f3',
    fontSize: 14,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#999',
    fontSize: 14,
  },
  note: {
    fontSize: 12,
    textAlign: 'center',
    color: '#999',
    marginTop: 20,
    lineHeight: 18,
  },
});
