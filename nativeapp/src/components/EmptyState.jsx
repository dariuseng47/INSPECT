import { MaterialCommunityIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import { brand } from '../theme/colors';
import { type } from '../theme/typography';

export function EmptyState({ icon = 'inbox-outline', title, description }) {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons name={icon} size={40} color={brand.grey[400]} />
      <Text style={[type.subtitle1, styles.title]}>{title}</Text>
      {description ? <Text style={[type.body2, styles.description]}>{description}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: 40,
    gap: 8,
  },
  title: {
    color: brand.grey[700],
  },
  description: {
    color: brand.grey[500],
    textAlign: 'center',
  },
});
