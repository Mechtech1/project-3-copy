import React from 'react';
import { View, StyleSheet } from 'react-native';
import SettingsScreen from '@/components/SettingsScreen';
import { useTheme } from '@/contexts/ThemeContext';

export default function SettingsTab() {
  const { colors } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SettingsScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});