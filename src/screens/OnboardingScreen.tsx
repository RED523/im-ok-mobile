import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Dimensions,
  Platform,
  Modal,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import monitoringService from '../services/monitoringService';
import { UserSettings } from '../types';

const { width } = Dimensions.get('window');

interface OnboardingProps {
  onComplete: (data: UserSettings) => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [userPhone, setUserPhone] = useState('');
  const [startTime, setStartTime] = useState('23:00');
  const [endTime, setEndTime] = useState('08:00');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [timeValidationError, setTimeValidationError] = useState<string>('');
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [activeTimePicker, setActiveTimePicker] = useState<'start' | 'end'>('start');
  const [tempTime, setTempTime] = useState<Date>(new Date());
  const [userPhoneError, setUserPhoneError] = useState<string>('');
  const [emergencyContactError, setEmergencyContactError] = useState<string>('');
  const [isUserPhoneFormatError, setIsUserPhoneFormatError] = useState<boolean>(false);
  const [isEmergencyContactFormatError, setIsEmergencyContactFormatError] = useState<boolean>(false);

  // 当时间变化时，自动更新校验状态
  useEffect(() => {
    if (step === 2) {
      const validation = monitoringService.validateTimeRange(startTime, endTime);
      setTimeValidationError(validation.error || '');
    }
  }, [startTime, endTime, step]);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete({ userPhone, startTime, endTime, emergencyContact });
    }
  };

  // 纯粹的校验函数，不更新状态
  const isTimeRangeValid = () => {
    const validation = monitoringService.validateTimeRange(startTime, endTime);
    return validation.valid;
  };

  const canProceed = () => {
    switch (step) {
      case 0:
        return true;
      case 1:
        return validatePhoneNumber(userPhone).valid;
      case 2:
        return isTimeRangeValid();
      case 3:
        return validatePhoneNumber(emergencyContact).valid;
      default:
        return false;
    }
  };

  // 验证手机号码格式
  const validatePhoneNumber = (phone: string): { 
    valid: boolean; 
    error?: string; 
    isFormatError?: boolean; // 是否是格式错误（需要显示红色边框）
  } => {
    if (!phone) {
      return { valid: false, error: '请输入手机号码', isFormatError: false };
    }
    
    if (phone.length !== 11) {
      // 长度不够，不算格式错误，只是提示
      return { valid: false, error: '请输入11位手机号码', isFormatError: false };
    }
    
    // 中国手机号码规则：第一位必须是1，第二位通常是3-9
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phone)) {
      // 格式错误，需要显示红色边框
      return { valid: false, error: '请输入正确的手机号码格式（以1开头，第二位为3-9）', isFormatError: true };
    }
    
    return { valid: true };
  };

  const getDateFromTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':').map(Number);
    const date = new Date();
    date.setHours(hours);
    date.setMinutes(minutes);
    date.setSeconds(0);
    date.setMilliseconds(0);
    return date;
  };

  const openTimePicker = (type: 'start' | 'end') => {
    setActiveTimePicker(type);
    setTempTime(getDateFromTime(type === 'start' ? startTime : endTime));
    setShowTimePicker(true);
  };

  const handleTimePickerChange = (event: any, selectedDate?: Date) => {
    console.log('Platform.OS', Platform.OS);
    
    if (Platform.OS === 'android') {
      if (event.type === 'dismissed') {
        setShowTimePicker(false);
        return;
      }
      if (event.type === 'set' && selectedDate) {
        // Android: 直接确认
        const hours = selectedDate.getHours().toString().padStart(2, '0');
        const minutes = selectedDate.getMinutes().toString().padStart(2, '0');
        const timeString = `${hours}:${minutes}`;
        if (activeTimePicker === 'start') {
          setStartTime(timeString);
        } else {
          setEndTime(timeString);
        }
        setShowTimePicker(false);
      }
    } else {
      // iOS: 更新临时值，等待确认
      if (selectedDate) {
        setTempTime(selectedDate);
      }
    }
  };

  const confirmTimePicker = () => {
    
    const hours = tempTime.getHours().toString().padStart(2, '0');
    const minutes = tempTime.getMinutes().toString().padStart(2, '0');
    const timeString = `${hours}:${minutes}`;
    console.log('设置的时间段：===========>', timeString);
    
    if (activeTimePicker === 'start') {
      setStartTime(timeString);
    } else {
      setEndTime(timeString);
    }
    setShowTimePicker(false);
  };

  const cancelTimePicker = () => {
    setShowTimePicker(false);
  };


  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Progress Indicator */}
        <View style={styles.progressContainer}>
          {[0, 1, 2, 3].map((i) => (
            <View
              key={i}
              style={[
                styles.progressBar,
                i <= step && styles.progressBarActive,
              ]}
            />
          ))}
        </View>

        {/* Content */}
        <View style={styles.content}>
          {step === 0 && (
            <View style={styles.stepContainer}>
              <View style={styles.iconContainer}>
                <Ionicons name="shield-checkmark" size={60} color="#3b82f6" />
              </View>
              <Text style={styles.title}>安全守护</Text>
              <Text style={styles.description}>
                如果你在设定的时间段内一次手机都没用过，我们会提醒你，必要时通知一个你信任的人。
              </Text>
              <View style={styles.featureList}>
                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <Ionicons name="time-outline" size={24} color="#3b82f6" />
                  </View>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>设置关键时间段</Text>
                    <Text style={styles.featureDesc}>自定义需要监测的时间范围</Text>
                  </View>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <Ionicons name="shield-checkmark-outline" size={24} color="#3b82f6" />
                  </View>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>自动监测保护</Text>
                    <Text style={styles.featureDesc}>无需主动操作，后台智能检测</Text>
                  </View>
                </View>
                <View style={styles.featureItem}>
                  <View style={styles.featureIconContainer}>
                    <Ionicons name="people-outline" size={24} color="#3b82f6" />
                  </View>
                  <View style={styles.featureText}>
                    <Text style={styles.featureTitle}>异常时通知</Text>
                    <Text style={styles.featureDesc}>异常情况下通知信任联系人</Text>
                  </View>
                </View>
              </View>
            </View>
          )}

          {step === 1 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>输入你的手机号</Text>
              <Text style={styles.stepDescription}>用于接收安全提醒通知</Text>
              <TextInput
                style={[
                  styles.input,
                  isUserPhoneFormatError && styles.inputError
                ]}
                value={userPhone}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, '').slice(0, 11);
                  setUserPhone(cleaned);
                  // 实时验证
                  if (cleaned.length > 0) {
                    const validation = validatePhoneNumber(cleaned);
                    setUserPhoneError(validation.error || '');
                    setIsUserPhoneFormatError(validation.isFormatError || false);
                  } else {
                    setUserPhoneError('');
                    setIsUserPhoneFormatError(false);
                  }
                }}
                placeholder="输入手机号码"
                keyboardType="phone-pad"
                maxLength={11}
                autoFocus
              />
              {userPhoneError && (
                <Text style={styles.errorText}>{userPhoneError}</Text>
              )}
            </View>
          )}

          {step === 2 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>设置监测时间段</Text>
              <Text style={styles.stepDescription}>
                选择需要监测的时间范围，建议设置为夜间睡眠时段（如 23:00 - 08:00），时间段应跨夜且不少于6小时
              </Text>
              <View style={styles.timePickerContainer}>
                <TouchableOpacity 
                  style={styles.timePickerRow}
                  onPress={() => openTimePicker('start')}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={styles.timeLabel}>开始时间</Text>
                    <Text style={styles.timeLabelSub}>监测开始</Text>
                  </View>
                  <View style={styles.timeValueContainer}>
                    <Text style={styles.timeInput}>{startTime}</Text>
                    <Ionicons name="time-outline" size={24} color="#94a3b8" />
                  </View>
                </TouchableOpacity>
                <View style={styles.timeSeparator} />
                <TouchableOpacity 
                  style={styles.timePickerRow}
                  onPress={() => openTimePicker('end')}
                  activeOpacity={0.7}
                >
                  <View>
                    <Text style={styles.timeLabel}>结束时间</Text>
                    <Text style={styles.timeLabelSub}>监测结束</Text>
                  </View>
                  <View style={styles.timeValueContainer}>
                    <Text style={styles.timeInput}>{endTime}</Text>
                    <Ionicons name="time-outline" size={24} color="#94a3b8" />
                  </View>
                </TouchableOpacity>
              </View>
              {timeValidationError ? (
                <View style={[styles.infoBox, styles.warningBox]}>
                  <Ionicons name="warning-outline" size={20} color="#f59e0b" />
                  <Text style={styles.infoText}>{timeValidationError}</Text>
                </View>
              ) : (
                <View style={[styles.infoBox, styles.successBox]}>
                  <Ionicons name="checkmark-circle" size={20} color="#3b82f6" />
                  <Text style={styles.infoText}>
                    默认时间段 23:00 - 08:00 覆盖夜间睡眠时段，最大程度保障安全
                  </Text>
                </View>
              )}

              {/* 时间选择器 Modal */}
              <Modal
                visible={showTimePicker}
                transparent
                animationType="slide"
                onRequestClose={cancelTimePicker}
              >
                <TouchableOpacity 
                  style={styles.modalOverlay}
                  activeOpacity={1}
                  onPress={cancelTimePicker}
                >
                  <TouchableOpacity 
                    activeOpacity={1} 
                    style={styles.timePickerModal}
                    onPress={(e) => e.stopPropagation()}
                  >
                    {/* Modal Header */}
                    <View style={styles.modalHeader}>
                      <TouchableOpacity onPress={cancelTimePicker}>
                        <Text style={styles.modalCancelText}>取消</Text>
                      </TouchableOpacity>
                      <Text style={styles.modalTitle}>
                        {activeTimePicker === 'start' ? '开始时间' : '结束时间'}
                      </Text>
                      <TouchableOpacity onPress={confirmTimePicker}>
                        <Text style={styles.modalConfirmText}>确定</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Time Picker */}
                    <View style={styles.pickerWrapper}>
                      <DateTimePicker
                        value={tempTime}
                        mode="time"
                        is24Hour={true}
                        display="spinner"
                        onChange={handleTimePickerChange}
                        style={styles.timePicker}
                      />
                    </View>
                  </TouchableOpacity>
                </TouchableOpacity>
              </Modal>
            </View>
          )}

          {step === 3 && (
            <View style={styles.stepContainer}>
              <Text style={styles.stepTitle}>添加信任联系人</Text>
              <Text style={styles.stepDescription}>仅在异常情况下通知此联系人</Text>
              <TextInput
                style={[
                  styles.input,
                  isEmergencyContactFormatError && styles.inputError
                ]}
                value={emergencyContact}
                onChangeText={(text) => {
                  const cleaned = text.replace(/\D/g, '').slice(0, 11);
                  setEmergencyContact(cleaned);
                  // 实时验证
                  if (cleaned.length > 0) {
                    const validation = validatePhoneNumber(cleaned);
                    setEmergencyContactError(validation.error || '');
                    setIsEmergencyContactFormatError(validation.isFormatError || false);
                  } else {
                    setEmergencyContactError('');
                    setIsEmergencyContactFormatError(false);
                  }
                }}
                placeholder="输入联系人手机号"
                keyboardType="phone-pad"
                maxLength={11}
                autoFocus
              />
              {emergencyContactError && (
                <Text style={styles.errorText}>{emergencyContactError}</Text>
              )}
              <View style={[styles.infoBox, styles.warningBox]}>
                <Ionicons name="information-circle-outline" size={20} color="#f59e0b" />
                <Text style={styles.infoText}>
                  我们仅在检测到异常且你未确认安全时，才会向此联系人发送短信通知。本产品不提供医疗或紧急救援服务。
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Bottom Button */}
        <TouchableOpacity
          style={[styles.button, !canProceed() && styles.buttonDisabled]}
          onPress={handleNext}
          disabled={!canProceed()}
        >
          <Text style={styles.buttonText}>
            {step === 3 ? '完成设置' : '继续'} 
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  progressContainer: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    marginBottom: 32,
  },
  progressBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#e2e8f0',
  },
  progressBarActive: {
    backgroundColor: '#3b82f6',
  },
  content: {
    flex: 1,
  },
  stepContainer: {
    flex: 1,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#e0f2fe',
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 20,
  },
  description: {
    fontSize: 17,
    color: '#64748b',
    lineHeight: 26,
    textAlign: 'center',
    marginBottom: 48,
  },
  featureList: {
    gap: 20,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 16,
  },
  featureIconContainer: {
    width: 56,
    height: 56,
    backgroundColor: '#e0f2fe',
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  featureText: {
    flex: 1,
    paddingTop: 4,
  },
  featureTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
    marginBottom: 6,
  },
  featureDesc: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
  },
  stepTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: 12,
  },
  stepDescription: {
    fontSize: 17,
    color: '#64748b',
    lineHeight: 24,
    marginBottom: 36,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#3b82f6',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginBottom: 16,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: -8,
    marginBottom: 16,
  },
  timePickerContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 28,
    marginBottom: 16,
  },
  timePickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#0f172a',
    marginBottom: 4,
  },
  timeLabelSub: {
    fontSize: 14,
    fontWeight: '400',
    color: '#64748b',
  },
  timeValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeInput: {
    fontSize: 32,
    fontWeight: '600',
    color: '#3b82f6',
    textAlign: 'right',
    minWidth: 100,
  },
  timeSeparator: {
    height: 1,
    backgroundColor: '#e2e8f0',
    marginVertical: 28,
  },
  infoBox: {
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  warningBox: {
    backgroundColor: '#fef3c7',
  },
  successBox: {
    backgroundColor: '#eff6ff',
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: '#0f172a',
    lineHeight: 20,
  },
  button: {
    backgroundColor: '#3b82f6',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginTop: 32,
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#cbd5e1',
    shadowOpacity: 0,
  },
  buttonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  // Modal 样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'flex-end',
  },
  timePickerModal: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: '#0f172a',
  },
  modalCancelText: {
    fontSize: 16,
    color: '#64748b',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  modalConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#3b82f6',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  pickerWrapper: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  timePicker: {
    width: width - 40,
    height: 200,
  },
});

