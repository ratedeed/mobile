import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';

import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ContractorSignupScreen from '../screens/ContractorSignupScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';

const Stack = createStackNavigator();

const screenOptions = {
  headerStyle: {
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7', // shadcn border
    shadowOpacity: 0,
    elevation: 0,
  },
  headerTitleStyle: {
    fontWeight: '600',
    fontSize: 18,
    color: '#09090B', // shadcn foreground
  },
  headerTintColor: '#2563EB', // shadcn primary
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
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Set New Password' }} />
      <Stack.Screen name="ContractorSignup" component={ContractorSignupScreen} options={{ title: 'Join as Pro' }} />
    </Stack.Navigator>
  );
}
