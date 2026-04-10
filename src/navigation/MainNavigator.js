import React from 'react';
import { createStackNavigator, CardStyleInterpolators } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome5 } from '@expo/vector-icons';
import { Image, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import HomeScreen from '../screens/HomeScreen';
import BusinessSearchScreen from '../screens/BusinessSearchScreen';
import BusinessDetailScreen from '../screens/BusinessDetailScreen.tsx';
import MessagesScreen from '../screens/MessagesScreen';
import ContractorDashboardScreen from '../screens/ContractorDashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';
import NotificationsScreen from '../screens/NotificationsScreen';

import Typography from '../components/common/Typography';
import { useAuth } from '../context/AuthContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

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

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'Search') {
            iconName = 'search';
          } else if (route.name === 'Messages') {
            iconName = 'comments';
          } else if (route.name === 'Profile') {
            iconName = 'user-circle';
          } else if (route.name === 'Dashboard') {
            iconName = 'chart-bar';
          }
          return <FontAwesome5 name={iconName} size={size} color={color} solid={focused} />;
        },
        tabBarActiveTintColor: '#2563EB', // shadcn primary
        tabBarInactiveTintColor: '#71717A', // shadcn muted foreground
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E4E4E7',
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom + 8,
          paddingTop: 8,
          elevation: 0,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
        headerStyle: {
          backgroundColor: '#FFFFFF',
          borderBottomWidth: 1,
          borderBottomColor: '#E4E4E7',
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTitleStyle: {
          fontWeight: '600',
          fontSize: 18,
          color: '#09090B',
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={({ navigation }) => ({
          title: 'Home',
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 16 }}>
              <Image
                source={require('../../assets/faviiocon.png')}
                style={{ width: 28, height: 28, marginRight: 8, borderRadius: 6 }}
              />
              <Typography variant="h4" style={{ color: '#09090B' }}>Ratedeed</Typography>
            </View>
          ),
          headerTitle: '',
          headerRight: () => (
            <TouchableOpacity 
              style={{ marginRight: 16, padding: 8 }}
              onPress={() => navigation.navigate('Notifications')}
            >
              <FontAwesome5 name="bell" size={20} color="#09090B" />
            </TouchableOpacity>
          ),
        })}
      />
      <Tab.Screen
        name="Search"
        component={BusinessSearchScreen}
        options={{ title: 'Search', headerShown: false }}
      />
      <Tab.Screen
        name="Messages"
        component={MessagesScreen}
        options={{ title: 'Messages', headerShown: false }}
      />
      {userRole === 'contractor' && (
        <Tab.Screen
          name="Dashboard"
          component={ContractorDashboardScreen}
          options={{ title: 'Dashboard', headerShown: false }}
        />
      )}
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ title: 'Profile', headerShown: false }}
      />
    </Tab.Navigator>
  );
}

export default function MainNavigator() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Main" component={MainTabNavigator} options={{ headerShown: false }} />
      <Stack.Screen name="BusinessDetail" component={BusinessDetailScreen} options={{ title: '' }} />
      <Stack.Screen name="ContractorDashboard" component={ContractorDashboardScreen} options={{ title: '' }} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="ChatScreen" component={MessagesScreen} options={{ title: 'Chat' }} />
    </Stack.Navigator>
  );
}
