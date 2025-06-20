import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';

const EmailVerificationPending = () => {
  const navigation = useNavigation();

  const handleGoToSignIn = () => {
    navigation.navigate('LoginScreen');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.message}>
        Your email verification is pending. Please check your inbox and click the verification link.
      </Text>
      <Button title="Go to Sign In" onPress={handleGoToSignIn} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  message: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 20,
  },
});

export default EmailVerificationPending;