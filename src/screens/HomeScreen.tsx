import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import monitoringService from '../services/monitoringService';
import { UserSettings } from '../types';

interface HomeScreenProps {
  settings: UserSettings;
  onSettings: () => void;
}

export default function HomeScreen({ settings, onSettings }: HomeScreenProps) {
  const [status, setStatus] = useState<'abnormal' | 'monitoring'>('monitoring');
  const [lastCheckTime, setLastCheckTime] = useState<string>('');
  const [isInPeriod, setIsInPeriod] = useState(false);

  // 监测逻辑 - 只有两个状态：监测中 和 异常
  useEffect(() => {
    const updateStatus = async () => {
      const now = new Date();
      const monitorSettings = await monitoringService.getSettings();
      
      if (!monitorSettings) {
        setStatus('monitoring');
        return;
      }

      // 检查是否在监测时间段内
      const inPeriod = monitoringService.isInMonitoringPeriod(now, monitorSettings);
      setIsInPeriod(inPeriod);

      // 获取今天的记录
      const record = await monitoringService.getTodayRecord();
      
      // 简化逻辑：只检查是否异常，其他情况都显示"监测中"
      if (record && record.isAbnormal && !record.userConfirmed) {
        // 只有真正的异常状态才改变
        setStatus('abnormal');
      } else {
        // 默认状态：监测中（包括正常情况）
        setStatus('monitoring');
      }

      // 更新最后活动时间显示
      if (inPeriod && record && record.lastUsageTime) {
        const lastTime = new Date(record.lastUsageTime);
        setLastCheckTime(
          lastTime.toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
          })
        );
      } else {
        const lastActivity = await monitoringService.getLastActivityTime();
        if (lastActivity) {
          const lastDate = new Date(lastActivity);
          const now = new Date();
          const diff = now.getTime() - lastDate.getTime();
          
          // 如果最近5分钟内有活动，显示最后活动时间
          if (diff < 5 * 60 * 1000) {
            setLastCheckTime(
              lastDate.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
              })
            );
          }
        }
      }
    };

    // 立即更新一次
    updateStatus();

    // 每30秒更新一次状态
    const checkInterval = setInterval(updateStatus, 30000);

    return () => clearInterval(checkInterval);
  }, [settings.startTime, settings.endTime]);

  const maskPhone = (phone: string) => {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>安全守护</Text>
            <Text style={styles.headerSubtitle}>为你提供安心保障</Text>
          </View>
          <TouchableOpacity style={styles.settingsButton} onPress={onSettings}>
            <Ionicons name="settings-outline" size={24} color="#64748b" />
          </TouchableOpacity>
        </View>

        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <View
              style={[
                styles.statusIconContainer,
                status === 'abnormal' && styles.statusIconContainerAbnormal,
              ]}
            >
              <Ionicons 
                name={status === 'abnormal' ? 'warning' : 'shield-checkmark'} 
                size={36} 
                color={status === 'abnormal' ? '#ef4444' : '#3b82f6'} 
              />
            </View>
            <View style={styles.statusTextContainer}>
              <Text style={styles.statusTitle}>
                {status === 'abnormal' ? '检测到异常' : '监测中'}
              </Text>
              <Text style={styles.statusDescription}>
                {status === 'abnormal'
                  ? '请确认你的安全状态'
                  : isInPeriod && lastCheckTime
                  ? `监测时段内 · 最后活动: ${lastCheckTime}`
                  : '守护功能运行中'}
              </Text>
            </View>
          </View>

          {status === 'monitoring' && (
            <View style={styles.statusInfoBox}>
              <Text style={styles.statusInfoText}>
                {isInPeriod
                  ? '正在监测中。系统会在后台自动记录你的使用行为，时段结束后将进行检查。'
                  : '守护功能已启动。在监测时段内，系统会自动检测你的安全状态。'}
              </Text>
            </View>
          )}
        </View>

        {/* Monitoring Period */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="time-outline" size={20} color="#3b82f6" />
            <Text style={styles.cardTitle}>监测时间段</Text>
          </View>
          <View style={styles.timeRangeContainer}>
            <View style={styles.timeColumn}>
              <Text style={styles.timeLabel}>开始</Text>
              <Text style={styles.timeValue}>{settings.startTime}</Text>
            </View>
            <View style={styles.timeSeparatorVertical} />
            <View style={styles.timeColumn}>
              <Text style={styles.timeLabel}>结束</Text>
              <Text style={styles.timeValue}>{settings.endTime}</Text>
            </View>
          </View>
        </View>

        {/* Emergency Contact */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="person-outline" size={20} color="#3b82f6" />
            <Text style={styles.cardTitle}>信任联系人</Text>
          </View>
          <View style={styles.contactContainer}>
            <Text style={styles.contactPhone}>{maskPhone(settings.emergencyContact)}</Text>
            <Text style={styles.contactNote}>仅在异常情况下通知</Text>
          </View>
        </View>

        {/* Info Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            本产品不提供医疗或紧急救援服务，仅作为安全提醒工具。
            {'\n'}
            不保证100%监测成功，请根据实际情况使用。
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f8fa',
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 32,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '600',
    color: '#0f172a',
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginTop: 4,
  },
  settingsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusCard: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusIconContainer: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  statusIconContainerAbnormal: {
    backgroundColor: '#fecaca',
  },
  statusTextContainer: {
    flex: 1,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 4,
  },
  statusDescription: {
    fontSize: 14,
    color: '#64748b',
  },
  statusInfoBox: {
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    padding: 16,
  },
  statusInfoText: {
    fontSize: 14,
    color: '#1e40af',
    lineHeight: 20,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  timeRangeContainer: {
    flexDirection: 'row',
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 16,
  },
  timeColumn: {
    flex: 1,
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 14,
    color: '#64748b',
    marginBottom: 8,
  },
  timeValue: {
    fontSize: 28,
    fontWeight: '600',
    color: '#0f172a',
  },
  timeSeparatorVertical: {
    width: 1,
    backgroundColor: '#e2e8f0',
    marginHorizontal: 16,
  },
  contactContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
  },
  contactPhone: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a',
    marginBottom: 4,
  },
  contactNote: {
    fontSize: 14,
    color: '#64748b',
  },
  footer: {
    backgroundColor: '#f1f5f9',
    borderRadius: 16,
    padding: 16,
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 18,
  },
});

