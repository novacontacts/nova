import { useEffect, useRef } from 'react';
import { Animated, Text, TextStyle } from 'react-native';

interface Props {
  value: number;
  style?: TextStyle;
  duration?: number;
}

export function AnimatedNumber({ value, style, duration = 600 }: Props) {
  const animValue = useRef(new Animated.Value(0)).current;
  const displayRef = useRef(0);
  const textRef = useRef<any>(null);

  useEffect(() => {
    const id = animValue.addListener(({ value: v }) => {
      displayRef.current = v;
      textRef.current?.setNativeProps({
        text: Math.round(v).toLocaleString('sv-SE', { maximumFractionDigits: 0 }),
      });
    });

    Animated.timing(animValue, {
      toValue: Math.abs(value),
      duration,
      useNativeDriver: false,
    }).start();

    return () => animValue.removeListener(id);
  }, [value]);

  return (
    <Text
      ref={textRef}
      style={style}
    >
      {Math.round(Math.abs(value)).toLocaleString('sv-SE', { maximumFractionDigits: 0 })}
    </Text>
  );
}
