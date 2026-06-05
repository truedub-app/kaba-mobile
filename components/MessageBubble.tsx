import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Image } from 'expo-image';
import { formatDate } from '@/src/lib/utils';
import type { Message } from '@/src/types';

const MAX_IMAGE_WIDTH = Dimensions.get('window').width * 0.65;

interface Props {
  message: Message;
  isMine: boolean;
}

export function MessageBubble({ message, isMine }: Props) {
  return (
    <View style={[styles.wrapper, isMine ? styles.wrapperMine : styles.wrapperOther]}>
      <View style={[styles.bubble, isMine ? styles.bubbleMine : styles.bubbleOther]}>
        {message.image_url && (
          <Image
            source={{ uri: message.image_url }}
            style={styles.image}
            contentFit="cover"
            transition={200}
          />
        )}
        {message.content && (
          <Text style={[styles.text, isMine ? styles.textMine : styles.textOther]}>
            {message.content}
          </Text>
        )}
      </View>
      <Text style={[styles.time, isMine ? styles.timeMine : styles.timeOther]}>
        {formatDate(message.created_at)}
        {isMine && message.read_at && '  ✓✓'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginVertical: 3,
    paddingHorizontal: 12,
    maxWidth: '80%',
  },
  wrapperMine: {
    alignSelf: 'flex-end',
    alignItems: 'flex-end',
  },
  wrapperOther: {
    alignSelf: 'flex-start',
    alignItems: 'flex-start',
  },
  bubble: {
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 9,
    overflow: 'hidden',
  },
  bubbleMine: {
    backgroundColor: '#15803d',
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: '#f3f4f6',
    borderBottomLeftRadius: 4,
  },
  image: {
    width: MAX_IMAGE_WIDTH,
    height: MAX_IMAGE_WIDTH * 0.75,
    borderRadius: 12,
    marginBottom: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 21,
  },
  textMine: {
    color: '#fff',
  },
  textOther: {
    color: '#111827',
  },
  time: {
    fontSize: 10,
    marginTop: 3,
    color: '#9ca3af',
  },
  timeMine: {
    color: '#86efac',
  },
  timeOther: {
    color: '#9ca3af',
  },
});
