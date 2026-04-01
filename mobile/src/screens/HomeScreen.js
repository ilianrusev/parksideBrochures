import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  FlatList,
  ScrollView,
  Text,
  Image,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import BrochurePage from "../components/BrochurePage";
import ImageViewer from "../components/ImageViewer";
import { fetchParksidePages } from "../api/client";

const SOURCES = ["lidl", "kaufland"];
const LOGOS = {
  lidl: require("../../assets/lidl-logo.png"),
  kaufland: require("../../assets/kaufland-logo.png"),
};

function chunkItems(items, columns) {
  const rows = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push({
      row: items.slice(i, i + columns),
      key: `row-${items[i].brochure_id}-${items[i].page_number}`,
    });
  }
  return rows;
}

export default function HomeScreen() {
  const [pages, setPages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [activeSource, setActiveSource] = useState("lidl");
  const [activeBrochureId, setActiveBrochureId] = useState(null);
  const [viewerPage, setViewerPage] = useState(null);

  const loadPages = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchParksidePages();
      setPages(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadPages();
  }, [loadPages]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadPages();
  }, [loadPages]);

  // Group pages by source → brochures
  const grouped = useMemo(() => {
    const map = { lidl: [], kaufland: [] };
    const seen = {};
    for (const page of pages) {
      const src = page.source || "lidl";
      const bid = page.brochure_id;
      if (!seen[bid]) {
        seen[bid] = { brochureId: bid, title: page.title, dateRange: page.date_range, source: src, allPages: [] };
        if (map[src]) map[src].push(seen[bid]);
      }
      seen[bid].allPages.push(page);
    }
    return map;
  }, [pages]);

  // Auto-select first brochure when switching source
  const brochures = grouped[activeSource] || [];
  useEffect(() => {
    if (brochures.length > 0 && !brochures.find((b) => b.brochureId === activeBrochureId)) {
      setActiveBrochureId(brochures[0].brochureId);
    }
  }, [activeSource, brochures, activeBrochureId]);

  const activeBrochure = brochures.find((b) => b.brochureId === activeBrochureId);
  const columns = 2;
  const rows = activeBrochure ? chunkItems(activeBrochure.allPages, columns) : [];

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#04412C" />
        <Text style={styles.loadingText}>Зареждаме Parkside предложения...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorIcon}>⚠️</Text>
        <Text style={styles.errorText}>Could not load brochures</Text>
        <Text style={styles.errorDetail}>{error}</Text>
        <Text style={styles.retry} onPress={loadPages}>
          Tap to retry
        </Text>
      </View>
    );
  }

  if (pages.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🔧</Text>
          <Text style={styles.emptyText}>
            За съжаление няма Parkside предложения в брошурите
          </Text>
          <Text style={styles.retry} onPress={loadPages}>
            Tap to refresh
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.outerWrapper}>
      <View style={styles.titleBarOuter}>
        <View style={[styles.titleBar, { maxWidth: 500, width: "100%" }]}>
          <View style={styles.titleRow}>
            <Text style={styles.titleWrench}>🔧</Text>
            <View>
              <Text style={styles.titleBarText}>
                <Text style={styles.titleHighlight}>PARKSIDE</Text> Предложения
              </Text>
              <Text style={styles.titleSubText}>Актуални оферти от брошурите</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.divider} />
      <SafeAreaView style={styles.safeArea}>

      {/* Source tabs */}
      <View style={styles.sourceTabs}>
        {SOURCES.map((src) => (
          <TouchableOpacity
            key={src}
            style={[styles.sourceTab, activeSource === src && styles.sourceTabActive]}
            onPress={() => setActiveSource(src)}
            activeOpacity={0.7}
          >
            <View style={styles.sourceTabInner}>
              <Image source={LOGOS[src]} style={styles.sourceLogo} />
              <Text style={[styles.sourceTabText, activeSource === src && styles.sourceTabTextActive]}>
                {src.toUpperCase()}
              </Text>
            </View>
            {activeSource === src && <View style={styles.sourceTabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>

      {/* Date picker */}
      {brochures.length > 0 && (
        <View style={styles.datePickerContainer}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.datePicker}
          >
          {brochures.map((b) => (
            <TouchableOpacity
              key={b.brochureId}
              style={[styles.dateChip, activeBrochureId === b.brochureId && styles.dateChipActive]}
              onPress={() => setActiveBrochureId(b.brochureId)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dateChipText, activeBrochureId === b.brochureId && styles.dateChipTextActive]}>
                {b.title}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        </View>
      )}

      {brochures.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyText}>За съжаление няма Parkside инструменти в брошурите на {activeSource}</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(item) => item.key}
          renderItem={({ item }) => (
            <View style={styles.row}>
              {item.row.map((page) => (
                <BrochurePage
                  key={`${page.brochure_id}-${page.page_number}`}
                  page={page}
                  onPress={setViewerPage}
                />
              ))}
            </View>
          )}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#04412C" />
          }
        />
      )}

      <ImageViewer page={viewerPage} visible={!!viewerPage} onClose={() => setViewerPage(null)} />
    </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  outerWrapper: {
    flex: 1,
    backgroundColor: "rgb(22, 24, 29)",
    alignItems: "center",
  },
  safeArea: {
    flex: 1,
    width: "100%",
    maxWidth: 500,
    backgroundColor: "rgb(22, 24, 29)",
  },
  titleBar: {
    backgroundColor: "rgb(22, 24, 29)",
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  titleBarOuter: {
    width: "100%",
    alignItems: "center",
    backgroundColor: "rgb(22, 24, 29)",
  },
  divider: {
    width: "100%",
    height: 1,
    backgroundColor: "rgb(40, 42, 48)",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  titleWrench: {
    fontSize: 30,
  },
  titleBarText: {
    color: "#fff",
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  titleHighlight: {
    color: "rgb(4, 65, 44)",
  },
  titleSubText: {
    color: "#888",
    fontSize: 12,
    marginTop: 4,
    letterSpacing: 0.3,
  },
  list: {
    paddingBottom: 16,
    paddingTop: 4,
  },
  row: {
    flexDirection: "row",
    justifyContent: "flex-start",
    paddingHorizontal: 12,
    marginBottom: 8,
    gap: 8,
  },
  sourceTabs: {
    flexDirection: "row",
    backgroundColor: "rgb(22, 24, 29)",
    borderBottomWidth: 1,
    borderBottomColor: "rgb(40, 42, 48)",
    paddingTop: 16,
  },
  sourceTab: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    position: "relative",
  },
  sourceTabActive: {
    opacity: 1,
  },
  sourceTabInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  sourceTabText: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#666",
  },
  sourceTabTextActive: {
    color: "rgb(4, 65, 44)",
  },
  sourceTabIndicator: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
    backgroundColor: "rgb(4, 65, 44)",
  },
  sourceLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  datePicker: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  datePickerContainer: {
    backgroundColor: "rgb(22, 24, 29)",
  },
  dateChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "rgb(40, 42, 48)",
    marginRight: 8,
  },
  dateChipActive: {
    backgroundColor: "rgb(4, 65, 44)",
  },
  dateChipText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#aaa",
  },
  dateChipTextActive: {
    color: "#fff",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 32,
    backgroundColor: "rgb(22, 24, 29)",
  },
  loadingText: {
    marginTop: 12,
    color: "#aaa",
    fontSize: 14,
  },
  errorIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ccc",
  },
  errorDetail: {
    fontSize: 13,
    color: "#888",
    marginTop: 4,
    textAlign: "center",
  },
  retry: {
    marginTop: 16,
    color: "rgb(4, 65, 44)",
    fontSize: 14,
    fontWeight: "600",
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#aaa",
    textAlign: "center",
  },
});
