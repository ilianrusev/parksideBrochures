import React, { useState, useEffect } from 'react';
import { Platform, View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import HomeScreen from './src/screens/HomeScreen';
import ArchiveScreen from './src/screens/ArchiveScreen';

export default function App() {
  const [activeTab, setActiveTab] = useState('home');

  useEffect(() => {
    if (Platform.OS === 'web') {
      const style = document.createElement('style');
      style.textContent = `
        html, body, #root { overflow: hidden; height: 100%; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        * { -ms-overflow-style: none; scrollbar-width: none; box-sizing: border-box; }
      `;
      document.head.appendChild(style);

      // Ensure viewport meta exists
      if (!document.querySelector('meta[name="viewport"]')) {
        const viewport = document.createElement('meta');
        viewport.name = 'viewport';
        viewport.content = 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no';
        document.head.appendChild(viewport);
      }

      // Favicon and meta tags
      const tags = [
        { tag: 'link', attrs: { rel: 'icon', type: 'image/png', href: '/favicon-96x96.png', sizes: '96x96' } },
        { tag: 'link', attrs: { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' } },
        { tag: 'link', attrs: { rel: 'shortcut icon', href: '/favicon.ico' } },
        { tag: 'link', attrs: { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' } },
        { tag: 'meta', attrs: { name: 'apple-mobile-web-app-title', content: 'Parkside Brochures' } },
        { tag: 'link', attrs: { rel: 'manifest', href: '/site.webmanifest' } },
      ];

      // Vercel Analytics
      const analyticsScript = document.createElement('script');
      analyticsScript.defer = true;
      analyticsScript.src = '/_vercel/insights/script.js';
      document.head.appendChild(analyticsScript);
      tags.forEach(({ tag, attrs }) => {
        const el = document.createElement(tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        document.head.appendChild(el);
      });
    }
  }, []);

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <View style={appStyles.container}>
        {activeTab === 'home' ? <HomeScreen /> : <ArchiveScreen />}
        <View style={appStyles.tabBar}>
          <TouchableOpacity
            style={[appStyles.tab, activeTab === 'home' && appStyles.tabActive]}
            onPress={() => setActiveTab('home')}
            activeOpacity={0.7}
          >
            <Text style={appStyles.tabIcon}>🔧</Text>
            <Text style={[appStyles.tabText, activeTab === 'home' && appStyles.tabTextActive]}>
              Актуални
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[appStyles.tab, activeTab === 'archive' && appStyles.tabActive]}
            onPress={() => setActiveTab('archive')}
            activeOpacity={0.7}
          >
            <Text style={appStyles.tabIcon}>📦</Text>
            <Text style={[appStyles.tabText, activeTab === 'archive' && appStyles.tabTextActive]}>
              Архив
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaProvider>
  );
}

const appStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(22, 24, 29)',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'rgb(30, 32, 38)',
    borderTopWidth: 1,
    borderTopColor: 'rgb(40, 42, 48)',
    paddingBottom: Platform.OS === 'ios' ? 20 : 8,
    paddingTop: 8,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 4,
  },
  tabActive: {},
  tabIcon: {
    fontSize: 20,
    marginBottom: 2,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: 'rgb(4, 65, 44)',
  },
});
