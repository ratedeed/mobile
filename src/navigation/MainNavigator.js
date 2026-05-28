import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome5 } from '@expo/vector-icons';
import { Image, View, TouchableOpacity, Text as RNText } from 'react-native';
import { useColorScheme } from 'nativewind';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { 
  MagnifyingGlass, 
  Heart, 
  Briefcase, 
  ChatCircle, 
  User as UserIcon,
  Bell,
  CaretLeft
} from 'phosphor-react-native';

import HomeScreen from '../screens/HomeScreen';
import BusinessSearchScreen from '../screens/BusinessSearchScreen';
import BusinessDetailScreen from '../screens/BusinessDetailScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ContractorDashboardScreen from '../screens/ContractorDashboardScreen';
import ContractorEditProfileScreen from '../screens/ContractorEditProfileScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ActiveJobsScreen from '../screens/ActiveJobsScreen';
import PaymentFlowScreen from '../screens/PaymentFlowScreen';
import SavedScreen from '../screens/SavedScreen';
import ReviewScreen from '../screens/ReviewScreen';
import DisputeScreen from '../screens/DisputeScreen';
import EarningsScreen from '../screens/EarningsScreen';
import ChangeOrderScreen from '../screens/ChangeOrderScreen';
import JobDetailScreen from '../screens/JobDetailScreen';
import ContractorOnboardingScreen from '../screens/ContractorOnboardingScreen';
import QuoteReviewScreen from '../screens/QuoteReviewScreen';
import VerifyEmailChangeScreen from '../screens/VerifyEmailChangeScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ContractorSignupScreen from '../screens/ContractorSignupScreen';

import Typography from '../components/common/Typography';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';

import ErrorBoundary from '../components/ErrorBoundary';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// Local ErrorBoundary Wrappers for Fragile Screens
const SafeHomeScreen = (props) => (
  <ErrorBoundary>
    <HomeScreen {...props} />
  </ErrorBoundary>
);
const SafeMessagesScreen = (props) => (
  <ErrorBoundary>
    <MessagesScreen {...props} />
  </ErrorBoundary>
);
const SafeBusinessDetailScreen = (props) => (
  <ErrorBoundary>
    <BusinessDetailScreen {...props} />
  </ErrorBoundary>
);
const SafeJobDetailScreen = (props) => (
  <ErrorBoundary>
    <JobDetailScreen {...props} />
  </ErrorBoundary>
);

// ---- Custom Center Tab Button ----
const JobsTabBarButton = ({ onPress }) => (
  <TouchableOpacity
    onPress={onPress}
    activeOpacity={0.8}
    style={{
      top: -24,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 10,
      elevation: 8
    }}
  >
    <View
      style={{
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#171717',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 2
      }}
    >
      <Briefcase size={28} color="#FFF" weight="fill" />
      <RNText style={{ color: '#FFF', fontSize: 10, fontWeight: '700' }}>Jobs</RNText>
    </View>
  </TouchableOpacity>
);

const screenOptions = {
  headerStyle: {
    borderBottomWidth: 1,
    borderBottomColor: '#E4E4E7',
    shadowOpacity: 0,
    elevation: 0,
  },
  headerTitleStyle: {
    fontWeight: '600',
    fontSize: 18,
  },
  headerTintColor: '#2563EB',
  headerBackTitleVisible: false,
  cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  gestureEnabled: true,
  gestureDirection: 'horizontal',
};

function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { userRole } = useAuth();
  const { unreadCount, unreadMessagesCount } = useNotifications();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          const weight = focused ? 'fill' : 'regular';
          if (route.name === 'Explore') {
            return <MagnifyingGlass size={24} color={color} weight={focused ? 'bold' : 'regular'} />;
          } else if (route.name === 'Saved') {
            return <Heart size={24} color={color} weight={weight} />;
          } else if (route.name === 'Messages') {
            return <ChatCircle size={24} color={color} weight={weight} />;
          } else if (route.name === 'Profile') {
            return <UserIcon size={24} color={color} weight={weight} />;
          }
          return null;
        },
        tabBarActiveTintColor: isDark ? '#FAFAFA' : '#171717',
        tabBarInactiveTintColor: isDark ? '#A1A1AA' : '#737373',
        tabBarStyle: {
          backgroundColor: isDark ? '#09090B' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: isDark ? '#27272A' : '#F0F0F0',
          height: 64 + insets.bottom,
          paddingBottom: insets.bottom + 4,
          paddingTop: 10,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginTop: 2,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Explore"
        component={SafeHomeScreen}
        options={({ navigation }) => ({
          title: 'Explore',
          headerShown: true,
          headerStyle: {
            backgroundColor: isDark ? '#09090B' : '#FFFFFF',
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#27272A' : '#E4E4E7',
            shadowOpacity: 0,
            elevation: 0,
          },
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
              <Image
                source={require('../../assets/favicon.png')}
                style={{ width: 28, height: 28, marginRight: 8, borderRadius: 6 }}
              />
              <Typography variant="h4" style={{ color: isDark ? '#FAFAFA' : '#09090B' }}>Ratedeed</Typography>
            </View>
          ),
          headerTitle: '',
          headerRight: () => (
            <TouchableOpacity 
              style={{ marginRight: 16, padding: 8 }}
              onPress={() => navigation.navigate('Notifications')}
            >
              <View>
                <Bell size={22} color={isDark ? '#FAFAFA' : '#09090B'} />
                {unreadCount > 0 && (
                  <View 
                    style={{ 
                      position: 'absolute', 
                      right: -6, 
                      top: -6, 
                      backgroundColor: '#EF4444', 
                      borderRadius: 9, 
                      minWidth: 18, 
                      height: 18, 
                      justifyContent: 'center', 
                      alignItems: 'center',
                      borderWidth: 2,
                      borderColor: isDark ? '#09090B' : '#FFFFFF',
                      paddingHorizontal: 2
                    }}
                  >
                    <RNText style={{ color: 'white', fontSize: 9, fontWeight: '700' }}>
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </RNText>
                  </View>
                )}
              </View>
            </TouchableOpacity>
          ),
        })}
      />
      <Tab.Screen
        name="Saved"
        component={SavedScreen}
        options={{ title: 'Saved' }}
      />
      <Tab.Screen
        name="Jobs"
        component={ActiveJobsScreen}
        options={{
          title: '', // Hide label for the center button as it's built-in
          tabBarButton: (props) => <JobsTabBarButton {...props} />
        }}
      />
      <Tab.Screen
        name="Messages"
        component={SafeMessagesScreen}
        options={{ 
          title: 'Messages',
          tabBarBadge: unreadMessagesCount > 0 ? unreadMessagesCount : undefined,
          tabBarBadgeStyle: {
            backgroundColor: '#EF4444',
            color: 'white',
            fontSize: 10,
            fontWeight: 'bold',
          }
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';
  const { userRole, isAuthenticated } = useAuth();

  const dynamicScreenOptions = {
    headerStyle: {
      backgroundColor: isDark ? '#09090B' : '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#27272A' : '#E4E4E7',
      shadowOpacity: 0,
      elevation: 0,
    },
    headerTitleStyle: {
      fontWeight: '600',
      fontSize: 18,
      color: isDark ? '#FAFAFA' : '#09090B',
    },
    headerTintColor: isDark ? '#FAFAFA' : '#09090B',
    headerBackTitleVisible: false,
    headerLeft: ({ canGoBack, onPress }) => 
      canGoBack ? (
        <TouchableOpacity 
          onPress={onPress} 
          style={{
            marginLeft: 16,
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: isDark ? '#27272A' : '#F4F4F5',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CaretLeft size={20} color={isDark ? '#FAFAFA' : '#09090B'} weight="bold" />
        </TouchableOpacity>
      ) : null,
    cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  };

  return (
    <Stack.Navigator screenOptions={dynamicScreenOptions}>
      <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="BusinessDetail" component={SafeBusinessDetailScreen} options={{ headerShown: false }} />
      {isAuthenticated && (userRole === 'contractor' || userRole === 'admin') ? (
        <>
          <Stack.Screen name="ContractorDashboard" component={ContractorDashboardScreen} options={{ title: '' }} />
          <Stack.Screen name="ContractorOnboarding" component={ContractorOnboardingScreen} options={{ headerShown: false }} />
          <Stack.Screen name="ContractorEditProfile" component={ContractorEditProfileScreen} options={{ headerShown: false }} />
          <Stack.Screen name="EarningsScreen" component={EarningsScreen} options={{ title: 'Earnings', headerShown: false }} />
        </>
      ) : null}
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ChatScreen" component={SafeMessagesScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ActiveJobs" component={ActiveJobsScreen} options={{ title: '', headerShown: false }} />
      <Stack.Screen name="PaymentFlow" component={PaymentFlowScreen} options={{ title: '', headerShown: false }} />
      <Stack.Screen name="ReviewScreen" component={ReviewScreen} options={{ title: 'Leave a Review' }} />
      <Stack.Screen name="DisputeScreen" component={DisputeScreen} options={{ title: 'File a Dispute' }} />
      <Stack.Screen name="ChangeOrderScreen" component={ChangeOrderScreen} options={{ title: 'Change Order' }} />
      <Stack.Screen name="JobDetail" component={SafeJobDetailScreen} options={{ title: '', headerShown: false }} />
      <Stack.Screen name="BusinessSearch" component={BusinessSearchScreen} options={{ title: '', headerShown: false }} />
      <Stack.Screen name="QuoteReview" component={QuoteReviewScreen} options={{ title: 'Review Quote' }} />
      <Stack.Screen name="VerifyEmailChange" component={VerifyEmailChangeScreen} options={{ title: 'Verify Email', headerShown: false }} />
      <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} options={{ title: 'Set New Password', headerShown: false }} />
      {/* Auth screens available within Main stack for guest browsing flow */}
      <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Sign In', headerShown: false }} />
      <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Create Account' }} />
      <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ title: 'Reset Password' }} />
      <Stack.Screen name="ContractorSignup" component={ContractorSignupScreen} options={{ title: 'Join as Pro', headerShown: false }} />
    </Stack.Navigator>
  );
}
