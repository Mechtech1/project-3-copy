import React from 'react';
import { View, StyleSheet } from 'react-native';
import RepairHistory from '@/components/RepairHistory';

export default function HistoryTab() {
  return (
    <View style={styles.container}>
      <RepairHistory />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111827',
  },
});