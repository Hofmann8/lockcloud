/**
 * Icon Component
 * 
 * Unified icon component using Ionicons for consistent modern icons across the app.
 * Replaces emoji icons with vector icons for better visual consistency.
 */

import Ionicons from '@expo/vector-icons/Ionicons';
import { ComponentProps } from 'react';
import { StyleProp, TextStyle } from 'react-native';

// Icon name mapping for semantic usage
export type IconName =
  | 'edit'
  | 'tag'
  | 'tag-remove'
  | 'delete'
  | 'warning'
  | 'file'
  | 'file-image'
  | 'file-video'
  | 'file-audio'
  | 'file-archive'
  | 'folder'
  | 'calendar'
  | 'search'
  | 'upload'
  | 'camera'
  | 'gallery'
  | 'close'
  | 'check'
  | 'chevron-left'
  | 'chevron-right'
  | 'chevron-down'
  | 'play'
  | 'wave'
  | 'retry'
  | 'remove'
  | 'add';

// Map semantic names to Ionicons names
const ICON_MAP: Record<IconName, ComponentProps<typeof Ionicons>['name']> = {
  'edit': 'pencil',
  'tag': 'pricetag',
  'tag-remove': 'pricetag-outline',
  'delete': 'trash',
  'warning': 'warning',
  'file': 'document',
  'file-image': 'image',
  'file-video': 'videocam',
  'file-audio': 'musical-notes',
  'file-archive': 'archive',
  'folder': 'folder',
  'calendar': 'calendar',
  'search': 'search',
  'upload': 'cloud-upload',
  'camera': 'camera',
  'gallery': 'images',
  'close': 'close',
  'check': 'checkmark',
  'chevron-left': 'chevron-back',
  'chevron-right': 'chevron-forward',
  'chevron-down': 'chevron-down',
  'play': 'play',
  'wave': 'hand-left',
  'retry': 'refresh',
  'remove': 'remove-circle',
  'add': 'add-circle',
};

export interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
}

/**
 * Icon - Unified icon component
 * 
 * Usage:
 * <Icon name="edit" size={20} color="#f97316" />
 */
export function Icon({ name, size = 24, color = '#000', style }: IconProps) {
  const iconName = ICON_MAP[name];
  return <Ionicons name={iconName} size={size} color={color} style={style} />;
}

export default Icon;
