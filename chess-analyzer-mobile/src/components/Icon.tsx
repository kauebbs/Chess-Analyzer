import React from 'react';
import Svg, { Circle, Line, Path, Polyline, Rect } from 'react-native-svg';

// Desenhos baseados no Lucide (https://lucide.dev, licença ISC), traço 24x24.
export type IconName =
  | 'settings'
  | 'import'
  | 'first'
  | 'prev'
  | 'next'
  | 'last'
  | 'flip'
  | 'reset'
  | 'review'
  | 'close'
  | 'search'
  | 'check'
  | 'home'
  | 'copy'
  | 'board'
  | 'paste'
  | 'zap'
  | 'gauge'
  | 'layers'
  | 'report'
  | 'branch'
  | 'flag'
  | 'equal'
  | 'users'
  | 'share'
  | 'clock'
  | 'link'
  | 'bot'
  | 'trophy'
  | 'swords'
  | 'plus'
  | 'minus'
  | 'play'
  | 'list'
  | 'chat'
  | 'volume';

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}

export const Icon: React.FC<IconProps> = ({ name, size = 22, color = '#fff', strokeWidth = 2 }) => {
  const common = {
    stroke: color,
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    fill: 'none',
  };

  const content = (() => {
    switch (name) {
      case 'settings':
        return (
          <>
            <Path
              {...common}
              d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"
            />
            <Circle {...common} cx="12" cy="12" r="3" />
          </>
        );
      case 'import':
        return (
          <>
            <Path {...common} d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <Polyline {...common} points="7 10 12 15 17 10" />
            <Path {...common} d="M12 15V3" />
          </>
        );
      case 'first':
        return (
          <>
            <Path {...common} d="m11 17-5-5 5-5" />
            <Path {...common} d="m18 17-5-5 5-5" />
          </>
        );
      case 'prev':
        return <Path {...common} d="m15 18-6-6 6-6" />;
      case 'next':
        return <Path {...common} d="m9 18 6-6-6-6" />;
      case 'last':
        return (
          <>
            <Path {...common} d="m6 17 5-5-5-5" />
            <Path {...common} d="m13 17 5-5-5-5" />
          </>
        );
      case 'flip':
        return (
          <>
            <Path {...common} d="m21 16-4 4-4-4" />
            <Path {...common} d="M17 20V4" />
            <Path {...common} d="m3 8 4-4 4 4" />
            <Path {...common} d="M7 4v16" />
          </>
        );
      case 'reset':
        return (
          <>
            <Path {...common} d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <Path {...common} d="M3 3v5h5" />
          </>
        );
      case 'review':
        return <Polyline {...common} points="22 12 18 12 15 21 9 3 6 12 2 12" />;
      case 'close':
        return (
          <>
            <Path {...common} d="M18 6 6 18" />
            <Path {...common} d="m6 6 12 12" />
          </>
        );
      case 'search':
        return (
          <>
            <Circle {...common} cx="11" cy="11" r="8" />
            <Path {...common} d="m21 21-4.3-4.3" />
          </>
        );
      case 'check':
        return <Path {...common} d="M20 6 9 17l-5-5" />;
      case 'home':
        return (
          <>
            <Path {...common} d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
            <Path {...common} d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
          </>
        );
      case 'copy':
        return (
          <>
            <Rect {...common} width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <Path {...common} d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </>
        );
      case 'board':
        return (
          <>
            <Rect {...common} width="18" height="18" x="3" y="3" rx="2" />
            <Path {...common} d="M3 9h18" />
            <Path {...common} d="M3 15h18" />
            <Path {...common} d="M9 3v18" />
            <Path {...common} d="M15 3v18" />
          </>
        );
      case 'paste':
        return (
          <>
            <Rect {...common} width="8" height="4" x="8" y="2" rx="1" ry="1" />
            <Path {...common} d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
          </>
        );
      case 'zap':
        return (
          <Path
            {...common}
            d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"
          />
        );
      case 'gauge':
        return (
          <>
            <Path {...common} d="m12 14 4-4" />
            <Path {...common} d="M3.34 19a10 10 0 1 1 17.32 0" />
          </>
        );
      case 'layers':
        return (
          <>
            <Path {...common} d="M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83Z" />
            <Path {...common} d="m22 17.65-9.17 4.16a2 2 0 0 1-1.66 0L2 17.65" />
            <Path {...common} d="m22 12.65-9.17 4.16a2 2 0 0 1-1.66 0L2 12.65" />
          </>
        );
      case 'report':
        return (
          <>
            <Path {...common} d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
            <Path {...common} d="M14 2v4a2 2 0 0 0 2 2h4" />
            <Path {...common} d="M10 9H8" />
            <Path {...common} d="M16 13H8" />
            <Path {...common} d="M16 17H8" />
          </>
        );
      case 'flag':
        return (
          <>
            <Path {...common} d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
            <Line {...common} x1="4" x2="4" y1="22" y2="15" />
          </>
        );
      case 'equal':
        return (
          <>
            <Line {...common} x1="5" x2="19" y1="9" y2="9" />
            <Line {...common} x1="5" x2="19" y1="15" y2="15" />
          </>
        );
      case 'bot':
        return (
          <>
            <Path {...common} d="M12 8V4H8" />
            <Rect {...common} x="4" y="8" width="16" height="12" rx="2" />
            <Path {...common} d="M2 14h2" />
            <Path {...common} d="M20 14h2" />
            <Path {...common} d="M15 13v2" />
            <Path {...common} d="M9 13v2" />
          </>
        );
      case 'trophy':
        return (
          <>
            <Path {...common} d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
            <Path {...common} d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
            <Path {...common} d="M4 22h16" />
            <Path {...common} d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
            <Path {...common} d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
            <Path {...common} d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
          </>
        );
      case 'swords':
        return (
          <>
            <Polyline {...common} points="14.5 17.5 3 6 3 3 6 3 17.5 14.5" />
            <Line {...common} x1="13" y1="19" x2="19" y2="13" />
            <Line {...common} x1="16" y1="16" x2="20" y2="20" />
            <Line {...common} x1="19" y1="21" x2="21" y2="19" />
            <Polyline {...common} points="14.5 6.5 18 3 21 3 21 6 17.5 9.5" />
            <Line {...common} x1="5" y1="14" x2="9" y2="18" />
            <Line {...common} x1="7" y1="17" x2="4" y2="20" />
            <Line {...common} x1="3" y1="19" x2="5" y2="21" />
          </>
        );
      case 'plus':
        return (
          <>
            <Path {...common} d="M5 12h14" />
            <Path {...common} d="M12 5v14" />
          </>
        );
      case 'minus':
        return <Path {...common} d="M5 12h14" />;
      case 'play':
        return <Path {...common} d="M6 3l14 9-14 9V3z" />;
      case 'chat':
        return <Path {...common} d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />;
      case 'volume':
        return (
          <>
            <Path {...common} d="M11 4.7a.7.7 0 0 0-1.2-.5L6.4 7.6A1.4 1.4 0 0 1 5.4 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.4a1.4 1.4 0 0 1 1 .4l3.4 3.4a.7.7 0 0 0 1.2-.5Z" />
            <Path {...common} d="M16 9a5 5 0 0 1 0 6" />
            <Path {...common} d="M19.4 18.4a9 9 0 0 0 0-12.7" />
          </>
        );
      case 'list':
        return (
          <>
            <Path {...common} d="M8 6h13" />
            <Path {...common} d="M8 12h13" />
            <Path {...common} d="M8 18h13" />
            <Path {...common} d="M3 6h.01" />
            <Path {...common} d="M3 12h.01" />
            <Path {...common} d="M3 18h.01" />
          </>
        );
      case 'users':
        return (
          <>
            <Path {...common} d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <Circle {...common} cx="9" cy="7" r="4" />
            <Path {...common} d="M22 21v-2a4 4 0 0 0-3-3.87" />
            <Path {...common} d="M16 3.13a4 4 0 0 1 0 7.75" />
          </>
        );
      case 'share':
        return (
          <>
            <Circle {...common} cx="18" cy="5" r="3" />
            <Circle {...common} cx="6" cy="12" r="3" />
            <Circle {...common} cx="18" cy="19" r="3" />
            <Line {...common} x1="8.59" x2="15.42" y1="13.51" y2="17.49" />
            <Line {...common} x1="15.41" x2="8.59" y1="6.51" y2="10.49" />
          </>
        );
      case 'clock':
        return (
          <>
            <Circle {...common} cx="12" cy="12" r="10" />
            <Polyline {...common} points="12 6 12 12 16 14" />
          </>
        );
      case 'link':
        return (
          <>
            <Path {...common} d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
            <Path {...common} d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
          </>
        );
      case 'branch':
        return (
          <>
            <Line {...common} x1="6" x2="6" y1="3" y2="15" />
            <Circle {...common} cx="18" cy="6" r="3" />
            <Circle {...common} cx="6" cy="18" r="3" />
            <Path {...common} d="M18 9a9 9 0 0 1-9 9" />
          </>
        );
      default:
        return <Rect {...common} x="4" y="4" width="16" height="16" />;
    }
  })();

  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {content}
    </Svg>
  );
};
