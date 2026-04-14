import React, { useState, useEffect } from 'react';
import {
  Modal,
  View,
  Image,
  Text,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  ScrollView,
} from 'react-native';

const ASPECT_RATIO = 2400 / 1398;

export default function ImageViewer({ pages, initialIndex, visible, onClose }) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex || 0);
  const { width, height } = useWindowDimensions();
  const maxWidth = Math.min(width, 500);
  const imageWidth = maxWidth;
  const imageHeight = Math.min(imageWidth * ASPECT_RATIO, height - 100);

  useEffect(() => {
    setCurrentIndex(initialIndex || 0);
  }, [initialIndex]);

  if (!pages || pages.length === 0 || !visible) return null;

  const safeIndex = Math.min(currentIndex, pages.length - 1);
  const page = pages[safeIndex];
  if (!page) return null;

  const hasPrev = safeIndex > 0;
  const hasNext = safeIndex < pages.length - 1;

  return (
    <Modal visible={visible} animationType="fade" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerText}>
            {page.date_range}
          </Text>
          <Text style={styles.pageCounter}>
            {safeIndex + 1} / {pages.length}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Text style={styles.closeBtnText}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.body}>
          {hasPrev && (
            <TouchableOpacity
              style={[styles.arrowBtn, styles.arrowLeft]}
              onPress={() => setCurrentIndex(safeIndex - 1)}
              activeOpacity={0.7}
            >
              <Text style={styles.arrowText}>‹</Text>
            </TouchableOpacity>
          )}
          <ScrollView
            key={safeIndex}
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            maximumZoomScale={3}
            minimumZoomScale={1}
            bouncesZoom
          >
            <Image
              source={{ uri: page.image_url }}
              style={{ width: imageWidth, height: imageHeight }}
              resizeMode="contain"
            />
          </ScrollView>
          {hasNext && (
            <TouchableOpacity
              style={[styles.arrowBtn, styles.arrowRight]}
              onPress={() => setCurrentIndex(safeIndex + 1)}
              activeOpacity={0.7}
            >
              <Text style={styles.arrowText}>›</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 50,
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  headerText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  pageCounter: {
    color: '#aaa',
    fontSize: 13,
    fontWeight: '600',
    marginLeft: 12,
    marginRight: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
  },
  arrowBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    zIndex: 10,
  },
  arrowLeft: {
    left: 8,
  },
  arrowRight: {
    right: 8,
  },
  arrowText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    marginTop: -2,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    alignItems: 'center',
    justifyContent: 'center',
    flexGrow: 1,
  },
});
