import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CloseButton, Text } from '@/components/ui';
import { Layout, Radius, usePalette } from '@/components/theme';

export interface PodSheetProps {
  readonly visible: boolean;
  readonly title: string;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly testID?: string;
}

/**
 * A small bottom sheet over the pod pages (the pod menu, the day and time pickers of "Suggest a time"): the
 * storyboards' sheet backdrop, a white panel with rounded top corners and a handle, a 18/800 title and the close
 * cross. The cross and the system back gesture close it; the backdrop is a shortcut for touch only.
 */
export function PodSheet({ visible, title, onClose, children, testID }: PodSheetProps) {
  const { t } = useTranslation();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.frame}>
        <Pressable onPress={onClose} accessible={false} importantForAccessibility="no" style={[StyleSheet.absoluteFill, { backgroundColor: p.scrim }]} />
        <View testID={testID} accessibilityViewIsModal style={[styles.panel, { backgroundColor: p.surface }]}>
          <View style={[styles.handle, { backgroundColor: p.borderStrong }]} accessible={false} importantForAccessibility="no" />
          <View style={styles.header}>
            <Text accessibilityRole="header" variant="cardTitle" style={styles.flex}>
              {title}
            </Text>
            <CloseButton onPress={onClose} accessibilityLabel={t('common.close')} />
          </View>
          <ScrollView contentContainerStyle={[styles.body, { paddingBottom: Math.max(insets.bottom, Layout.bottom) }]}>{children}</ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  frame: { flex: 1, justifyContent: 'flex-end' },
  panel: { maxHeight: '85%', borderTopLeftRadius: Radius.panel, borderTopRightRadius: Radius.panel, paddingTop: 10 },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: Layout.gutter, paddingRight: Layout.gutter, paddingTop: 6 },
  body: { paddingHorizontal: Layout.gutter, paddingTop: 8, gap: 12 },
});
