import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Modal,
  Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import monitoringService from '../services/monitoringService';
import { UserSettings } from '../types';

interface SettingsScreenProps {
  settings: UserSettings;
  onBack: () => void;
  onUpdate: (data: Omit<UserSettings, 'userPhone'>) => void;
  onReset: () => void;
}

export default function SettingsScreen({
  settings,
  onBack,
  onUpdate,
  onReset,
}: SettingsScreenProps) {
  const [editingStartTime, setEditingStartTime] = useState(settings.startTime);
  const [editingEndTime, setEditingEndTime] = useState(settings.endTime);
  const [editingContact, setEditingContact] = useState(settings.emergencyContact);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [timeValidationError, setTimeValidationError] = useState<string>('');
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const maskPhone = (phone: string) => {
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  };

  const hasChanges =
    editingStartTime !== settings.startTime ||
    editingEndTime !== settings.endTime ||
    editingContact !== settings.emergencyContact;

  // 当时间变化时校验
  useEffect(() => {
    const validation = monitoringService.validateTimeRange(editingStartTime, editingEndTime);
    setTimeValidationError(validation.error || '');
  }, [editingStartTime, editingEndTime]);

  // 纯粹的校验函数，不更新状态
  const isTimeRangeValid = () => {
    const validation = monitoringService.validateTimeRange(editingStartTime, editingEndTime);
    return validation.valid;
  };

  const canSave = () => {
    return hasChanges && isTimeRangeValid() && editingContact.length === 11;
  };

  const handleSave = () => {
    if (!canSave()) return;
    
    onUpdate({
      startTime: editingStartTime,
      endTime: editingEndTime,
      emergencyContact: editingContact,
    });
  };

  const handleReset = () => {
    onReset();
    setShowResetConfirm(false);
  };

  const handleTimeChange = (type: 'start' | 'end', selectedDate?: Date) => {
    if (Platform.OS === 'android') {
      setShowStartTimePicker(false);
      setShowEndTimePicker(false);
    }
    
    if (selectedDate) {
      const hours = selectedDate.getHours().toString().padStart(2, '0');
      const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
      const timeString = `${hours}:${minutes}`;
      
      if (type === 'start') {
        setEditingStartTime(timeString);
      } else {
        setEditingEndTime(timeString);
      }
    }
  };

  const getDateFromTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    return date;
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Ionicons name="chevron-back" size={24} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>设置</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person-outline" size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>账号信息</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>手机号</Text>
            <Text style={styles.infoValue}>{maskPhone(settings.userPhone)}</Text>
          </View>
        </View>

        {/* Monitoring Period */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="time-outline" size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>监测时间段</Text>
          </View>
          <View style={styles.timeContainer}>
            <TouchableOpacity 
              style={styles.timeRow}
              onPress={() => setShowStartTimePicker(true)}
            >
              <Text style={styles.timeLabel}>开始时间</Text>
              <View style={styles.timeValueContainer}>
                <Text style={styles.timeInput}>{editingStartTime}</Text>
                <Ionicons name="time-outline" size={20} color="#94a3b8" />
              </View>
            </TouchableOpacity>
            <View style={styles.timeSeparator} />
            <TouchableOpacity 
              style={styles.timeRow}
              onPress={() => setShowEndTimePicker(true)}
            >
              <Text style={styles.timeLabel}>结束时间</Text>
              <View style={styles.timeValueContainer}>
                <Text style={styles.timeInput}>{editingEndTime}</Text>
                <Ionicons name="time-outline" size={20} color="#94a3b8" />
              </View>
            </TouchableOpacity>
          </View>
          {timeValidationError ? (
            <View style={[styles.hintBox, styles.warningBox]}>
              <Ionicons name="warning-outline" size={16} color="#f59e0b" />
              <Text style={styles.hintText}>{timeValidationError}</Text>
            </View>
          ) : (
            <View style={[styles.hintBox, styles.infoBox]}>
              <Ionicons name="information-circle-outline" size={16} color="#3b82f6" />
              <Text style={styles.hintText}>时间段应跨夜且不少于6小时</Text>
            </View>
          )}
          {showStartTimePicker && (
            <DateTimePicker
              value={getDateFromTime(editingStartTime)}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event: any, date?: Date) => {
                if (Platform.OS === 'android') {
                  setShowStartTimePicker(false);
                }
                if (event.type === 'set' && date) {
                  handleTimeChange('start', date);
                } else if (event.type === 'dismissed') {
                  setShowStartTimePicker(false);
                }
              }}
            />
          )}
          {showEndTimePicker && (
            <DateTimePicker
              value={getDateFromTime(editingEndTime)}
              mode="time"
              is24Hour={true}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={(event: any, date?: Date) => {
                if (Platform.OS === 'android') {
                  setShowEndTimePicker(false);
                }
                if (event.type === 'set' && date) {
                  handleTimeChange('end', date);
                } else if (event.type === 'dismissed') {
                  setShowEndTimePicker(false);
                }
              }}
            />
          )}
        </View>

        {/* Emergency Contact */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications-outline" size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>信任联系人</Text>
          </View>
          <TextInput
            style={styles.input}
            value={editingContact}
            onChangeText={(text) =>
              setEditingContact(text.replace(/\D/g, '').slice(0, 11))
            }
            placeholder="输入联系人手机号"
            keyboardType="phone-pad"
            maxLength={11}
          />
          <View style={[styles.hintBox, styles.warningBox]}>
            <Ionicons name="information-circle-outline" size={16} color="#f59e0b" />
            <Text style={styles.hintText}>
              仅在检测到异常且你未确认安全时，才会通知此联系人
            </Text>
          </View>
        </View>

        {/* About */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#3b82f6" />
            <Text style={styles.sectionTitle}>关于</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>版本</Text>
            <Text style={styles.infoValue}>MVP v1.0</Text>
          </View>
          <View style={styles.disclaimerBox}>
            <Text style={styles.disclaimerText}>
              本产品不提供医疗或紧急救援服务，仅作为安全提醒工具。不保证100%监测成功，请根据实际情况使用。
            </Text>
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="trash-outline" size={20} color="#ef4444" />
            <Text style={styles.sectionTitle}>危险区域</Text>
          </View>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => setShowResetConfirm(true)}
          >
            <Text style={styles.resetButtonText}>清除所有数据</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save Button */}
      {hasChanges && (
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity
            style={[styles.saveButton, !canSave() && styles.saveButtonDisabled]}
            onPress={handleSave}
            disabled={!canSave()}
          >
            <Text style={styles.saveButtonText}>保存更改</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Reset Confirmation Dialog */}
      <Modal
        visible={showResetConfirm}
        transparent
        animationType="fade"
        onRequestClose={() => setShowResetConfirm(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="trash" size={32} color="#ef4444" />
            </View>
            <Text style={styles.modalTitle}>确认清除数据</Text>
            <Text style={styles.modalDescription}>
              这将删除所有设置和数据，需要重新配置。此操作不可撤销。
            </Text>
            <TouchableOpacity style={styles.modalConfirmButton} onPress={handleReset}>
              <Text style={styles.modalConfirmText}>确认清除</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={() => setShowResetConfirm(false)}
            >
              <Text style={styles.modalCancelText}>取消</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#0f172a',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0f172a',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 16,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a',
  },
  timeContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '400',
    color: '#64748b',
  },
  timeValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    fontSize: 28,
    fontWeight: '600',
    color: '#3b82f6',
    textAlign: 'right',
    minWidth: 80,
  },
  timeSeparator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 20,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  hintBox: {
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  warningBox: {
    backgroundColor: '#fef3c7',
  },
  infoBox: {
    backgroundColor: '#eff6ff',
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: '#0f172a',
    lineHeight: 18,
  },
  disclaimerBox: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
  },
  disclaimerText: {
    fontSize: 12,
    color: '#64748b',
    lineHeight: 18,
  },
  resetButton: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#dc2626',
  },
  saveButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
    padding: 24,
  },
  saveButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  saveButtonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
  },
  saveButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    width: '100%',
    maxWidth: 400,
  },
  modalIconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  modalConfirmButton: {
    backgroundColor: '#dc2626',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginBottom: 12,
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  modalCancelButton: {
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#0f172a',
  },
});

