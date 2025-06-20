import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { FontAwesome5 } from '@expo/vector-icons';
import { Image, View, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// Import screens
import HomeScreen from '../screens/HomeScreen';
import BusinessSearchScreen from '../screens/BusinessSearchScreen';
import BusinessDetailScreen from '../screens/BusinessDetailScreen';
import MessagesScreen from '../screens/MessagesScreen';
import AdminDashboardScreen from '../screens/AdminDashboardScreen';
import ContractorDashboardScreen from '../screens/ContractorDashboardScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Import design tokens
import { Spacing, Radii, Colors, Shadows } from '../constants/designTokens';
import Typography from '../components/common/Typography';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  const insets = useSafeAreaInsets();

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
          }
          return <FontAwesome5 name={iconName} size={size} color={color} solid={focused} />;
        },
        tabBarActiveTintColor: Colors.primary500,
        tabBarInactiveTintColor: Colors.neutral400,
        tabBarStyle: {
          backgroundColor: Colors.neutral50,
          borderTopWidth: 0,
          ...Shadows.lg,
          height: Spacing.xxxl + insets.bottom,
          paddingBottom: insets.bottom + Spacing.xs,
          paddingTop: Spacing.sm,
          borderTopLeftRadius: Radii.lg,
          borderTopRightRadius: Radii.lg,
          overflow: 'hidden',
        },
        tabBarLabelStyle: {
          fontSize: 13,
          fontWeight: '700',
          marginTop: Spacing.xxs,
        },
        headerStyle: {
          backgroundColor: Colors.primary500,
          borderBottomWidth: 0,
          shadowOpacity: 0,
          elevation: 0,
        },
        headerTitleStyle: {
          fontWeight: '800',
          fontSize: 22,
          color: Colors.neutral50,
          letterSpacing: 0.8,
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Home',
          headerLeft: () => (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: Spacing.lg }}>
              <Image
                source={require('../../assets/faviiocon.png')} // Adjusted path for assets
                style={{ width: Spacing.xl, height: Spacing.xl, marginRight: Spacing.xs, borderRadius: Radii.xs }}
              />
              <Typography variant="h4" style={{ color: Colors.neutral50, letterSpacing: 0.5 }}>Ratedeed</Typography>
            </View>
          ),
          headerTitle: '',
          headerRight: () => (
            <TouchableOpacity style={{ marginRight: Spacing.lg, padding: Spacing.xs }}>
              <FontAwesome5 name="bell" size={Spacing.lg} color={Colors.neutral50} />
            </TouchableOpacity>
          ),
        }}
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
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Main" component={MainTabNavigator} />
      <Stack.Screen name="BusinessDetail" component={BusinessDetailScreen} />
      <Stack.Screen name="AdminDashboard" component={AdminDashboardScreen} />
      <Stack.Screen name="ContractorDashboard" component={ContractorDashboardScreen} />
    </Stack.Navigator>
  );
}