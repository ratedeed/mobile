import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome5 } from '@expo/vector-icons';
import { Image, View, TouchableOpacity, Text as RNText } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from 'nativewind';
import { 
  MagnifyingGlass, 
  Heart, 
  Briefcase, 
  ChatCircle, 
  User as UserIcon,
  Bell
} from 'phosphor-react-native';

import HomeScreen from '../screens/HomeScreen';
import BusinessSearchScreen from '../screens/BusinessSearchScreen';
import BusinessDetailScreen from '../screens/BusinessDetailScreen.tsx';
import MessagesScreen from '../screens/MessagesScreen';
import ContractorDashboardScreen from '../screens/ContractorDashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import ActiveJobsScreen from '../screens/ActiveJobsScreen';
import PaymentFlowScreen from '../screens/PaymentFlowScreen';
import SavedScreen from '../screens/SavedScreen';

import Typography from '../components/common/Typography';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

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

function MainTabNavigator() {
  const insets = useSafeAreaInsets();
  const { userRole } = useAuth();
  const { unreadCount, unreadMessagesCount } = useNotifications();
  const { colorScheme } = useColorScheme();
  const isDark = colorScheme === 'dark';

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
        tabBarActiveTintColor: isDark ? '#FFFFFF' : '#171717',
        tabBarInactiveTintColor: isDark ? '#A3A3A3' : '#737373',
        tabBarStyle: {
          backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: isDark ? '#262626' : '#F0F0F0',
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
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'Explore',
          headerShown: true,
          headerStyle: {
            backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
            borderBottomWidth: 1,
            borderBottomColor: isDark ? '#262626' : '#E4E4E7',
            shadowOpacity: 0,
            elevation: 0,
          },
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
              <Image
                source={require('../../assets/faviiocon.png')}
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
                      borderColor: isDark ? '#0A0A0A' : '#FFFFFF',
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
        component={MessagesScreen}
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

  const dynamicScreenOptions = {
    headerStyle: {
      backgroundColor: isDark ? '#0A0A0A' : '#FFFFFF',
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#262626' : '#E4E4E7',
      shadowOpacity: 0,
      elevation: 0,
    },
    headerTitleStyle: {
      fontWeight: '600',
      fontSize: 18,
      color: isDark ? '#FAFAFA' : '#09090B',
    },
    headerTintColor: isDark ? '#6366F1' : '#2563EB',
    cardStyleInterpolator: CardStyleInterpolators.forHorizontalIOS,
  };

  return (
    <Stack.Navigator screenOptions={dynamicScreenOptions}>
      <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="BusinessDetail" component={BusinessDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="ContractorDashboard" component={ContractorDashboardScreen} options={{ title: '' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ChatScreen" component={MessagesScreen} options={{ title: 'Chat' }} />
      <Stack.Screen name="ActiveJobs" component={ActiveJobsScreen} options={{ title: '', headerShown: false }} />
      <Stack.Screen name="PaymentFlow" component={PaymentFlowScreen} options={{ title: '', headerShown: false }} />
    </Stack.Navigator>
  );
}
