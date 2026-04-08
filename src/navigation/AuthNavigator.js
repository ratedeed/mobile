import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ContractorSignupScreen from '../screens/ContractorSignupScreen';

import { Colors } from '../constants/designTokens';

const Stack = createStackNavigator();

const screenOptions = {
  headerStyle: {
    backgroundColor: Colors.neutral50,
    borderBottomWidth: 0,
    shadowOpacity: 0,
    elevation: 0,
  },
  headerTitleStyle: {
    fontWeight: '600',
    fontSize: 18,
    color: Colors.neutral900,
  },
  headerTintColor: Colors.primary500,
  headerBackTitleVisible: false,
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  gestureEnabled: true,
  gestureDirection: 'horizontal',
};

export default function AuthNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Account' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset Password' }} />
      <Stack.Screen name="ContractorSignup" component={ContractorSignupScreen} options={{ title: 'Join as Pro' }} />
    </Stack.Navigator>
  );
}