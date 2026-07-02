import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  Animated,
  Dimensions,
  StyleSheet,
  Easing,
} from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Svg, Text as SvgText, Defs, LinearGradient as SvgGradient, Stop, Rect } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const ESCROW_BANNER_KEY = '@escrow_banner_dismissed_at';
// Show the banner again after 7 days
const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

// ---- Animated Gradient Text Component (using SVG to avoid native MaskedView crashes) ----
const AnimatedGradientText = ({ text }: { text: string }) => {
  const animatedValue = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 3000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, [animatedValue]);

  const translateX = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [-100, 100],
  });

  return (
    <View style={{ width: 70, height: 24 }}>
      <Svg height="24" width="70" viewBox="0 0 70 24">
        <Defs>
          <SvgGradient id="grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <Stop offset="0%" stopColor="#4F46E5" />
            <Stop offset="25%" stopColor="#6366F1" />
            <Stop offset="50%" stopColor="#A5B4FC" />
            <Stop offset="75%" stopColor="#6366F1" />
            <Stop offset="100%" stopColor="#4F46E5" />
          </SvgGradient>
        </Defs>
        <Animated.View style={{ transform: [{ translateX }] }}>
          <Rect x="-100" y="0" width="300" height="24" fill="url(#grad)" />
        </Animated.View>
        <SvgText
          fill="url(#grad)"
          fontSize="17"
          fontWeight="800"
          x="0"
          y="18"
        >
          {text}
        </SvgText>
      </Svg>
    </View>
  );
};

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export const EscrowTrustBanner = () => {
  const [visible, setVisible] = useState(false);
  
  const slideAnim = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const hammerRotate = useRef(new Animated.Value(0)).current;
  
  // Staggered text animations
  const text1Opacity = useRef(new Animated.Value(0)).current;
  const text1Y = useRef(new Animated.Value(10)).current;
  const text2Opacity = useRef(new Animated.Value(0)).current;
  const text2Y = useRef(new Animated.Value(10)).current;
  const text3Opacity = useRef(new Animated.Value(0)).current;
  const text3Y = useRef(new Animated.Value(10)).current;

  const startHammerAnimation = useCallback(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(hammerRotate, {
          toValue: -45,
          duration: 400,
          easing: Easing.out(Easing.back(1.5)),
          useNativeDriver: true,
        }),
        Animated.timing(hammerRotate, {
          toValue: 0,
          duration: 150,
          easing: Easing.bounce,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
      ])
    ).start();
  }, [hammerRotate]);

  const show = useCallback(() => {
    setVisible(true);
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 1000,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
    ]).start(() => {
      startHammerAnimation();
      
      // Staggered text reveal exactly like web version (delay-based)
      Animated.stagger(200, [
        Animated.parallel([
          Animated.timing(text1Opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(text1Y, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(text2Opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(text2Y, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(text3Opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
          Animated.timing(text3Y, { toValue: 0, duration: 500, useNativeDriver: true }),
        ]),
      ]).start();
    });
  }, [slideAnim, opacityAnim, startHammerAnimation, text1Opacity, text1Y, text2Opacity, text2Y, text3Opacity, text3Y]);

  const dismiss = useCallback(() => {
    // Persist dismissal timestamp so it doesn't show again for a while
    AsyncStorage.setItem(ESCROW_BANNER_KEY, Date.now().toString()).catch(() => {});

    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 300,
        duration: 600,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setVisible(false);
      text1Opacity.setValue(0);
      text1Y.setValue(10);
      text2Opacity.setValue(0);
      text2Y.setValue(10);
      text3Opacity.setValue(0);
      text3Y.setValue(10);
      hammerRotate.setValue(0);
    });
  }, [slideAnim, opacityAnim, text1Opacity, text1Y, text2Opacity, text2Y, text3Opacity, text3Y, hammerRotate]);

  useEffect(() => {
    let timer: any;

    // Check AsyncStorage to see if we've already shown the banner recently
    AsyncStorage.getItem(ESCROW_BANNER_KEY)
      .then((val) => {
        if (val) {
          const dismissedAt = parseInt(val, 10);
          if (!isNaN(dismissedAt) && Date.now() - dismissedAt < DISMISS_DURATION_MS) {
            // Dismissed recently, don't show
            return;
          }
        }
        // Show banner after a short delay
        timer = setTimeout(() => {
          show();
        }, 3300);
      })
      .catch(() => {
        // On error reading storage, show the banner anyway
        timer = setTimeout(() => {
          show();
        }, 3300);
      });

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [show]);

  if (!visible) return null;

  const rotateInterpolate = hammerRotate.interpolate({
    inputRange: [-45, 0],
    outputRange: ['-45deg', '0deg'],
  });

  return (
    <>
      {/* Backdrop — tap anywhere to dismiss */}
      <AnimatedPressable style={[styles.overlay, { opacity: opacityAnim }]} onPress={dismiss} />

      {/* Banner wrapper — lets touches pass through to backdrop except on the banner itself */}
      <View style={styles.container} pointerEvents="box-none">
        <Animated.View
          style={[
            styles.banner,
            {
              transform: [{ translateY: slideAnim }],
              opacity: opacityAnim,
            }
          ]}
          pointerEvents="auto"
        >
          <View style={styles.content}>
            <Animated.View style={[styles.iconContainer, { transform: [{ rotate: rotateInterpolate }] }]}>
              <FontAwesome5 name="hammer" size={32} color="#4F46E5" />
            </Animated.View>

            <View style={styles.textContainer}>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
                <Animated.View style={{ opacity: text1Opacity, transform: [{ translateY: text1Y }] }}>
                  <Text style={styles.text}>Your money is held in </Text>
                </Animated.View>
                
                <Animated.View style={{ opacity: text2Opacity, transform: [{ translateY: text2Y }] }}>
                  <AnimatedGradientText text="escrow " />
                </Animated.View>
                
                <Animated.View style={{ opacity: text3Opacity, transform: [{ translateY: text3Y }] }}>
                  <Text style={styles.text}>until the job is done right.</Text>
                </Animated.View>
              </View>
            </View>

            <Pressable onPress={dismiss} style={styles.closeButton}>
              <FontAwesome5 name="times" size={18} color="#A3A3A3" />
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  banner: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingVertical: 28,
    paddingHorizontal: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 10,
    maxWidth: 520,
    alignSelf: 'center',
    width: '100%',
    zIndex: 9999,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconContainer: {
    width: 56,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    paddingRight: 10,
  },
  text: {
    fontSize: 17,
    color: '#1f2937',
    lineHeight: 24,
  },
  bold: {
    fontWeight: '800',
    color: '#111827',
    fontSize: 17,
    lineHeight: 24,
  },
  closeButton: {
    position: 'absolute',
    top: -12,
    right: -8,
    padding: 12,
  },
});
