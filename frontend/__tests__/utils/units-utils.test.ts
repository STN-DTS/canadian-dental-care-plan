import { describe, expect, it } from 'vitest';

import {
  bytesToFilesize,
  bytesToKilobytes,
  bytesToMegabytes,
  hoursToMinutes,
  hoursToSeconds,
  kilobytesToBytes,
  kilobytesToMegabytes,
  megabytesToBytes,
  megabytesToKilobytes,
  millisecondsToSeconds,
  minutesToHours,
  minutesToSeconds,
  secondsToHours,
  secondsToMilliseconds,
  secondsToMinutes,
} from '~/utils/units-utils';

describe('File Size Conversion Utilities', () => {
  describe('bytesToKilobytes', () => {
    it('should convert bytes to kilobytes', () => {
      expect(bytesToKilobytes(1024)).toBe(1);
      expect(bytesToKilobytes(2048)).toBe(2);
      expect(bytesToKilobytes(512)).toBe(0.5);
      expect(bytesToKilobytes(0)).toBe(0);
    });
  });

  describe('kilobytesToBytes', () => {
    it('should convert kilobytes to bytes', () => {
      expect(kilobytesToBytes(1)).toBe(1024);
      expect(kilobytesToBytes(2)).toBe(2048);
      expect(kilobytesToBytes(0.5)).toBe(512);
      expect(kilobytesToBytes(0)).toBe(0);
    });
  });

  describe('bytesToMegabytes', () => {
    it('should convert bytes to megabytes', () => {
      expect(bytesToMegabytes(1_048_576)).toBe(1);
      expect(bytesToMegabytes(5_242_880)).toBe(5);
      expect(bytesToMegabytes(524_288)).toBe(0.5);
      expect(bytesToMegabytes(0)).toBe(0);
    });
  });

  describe('megabytesToBytes', () => {
    it('should convert megabytes to bytes', () => {
      expect(megabytesToBytes(1)).toBe(1_048_576);
      expect(megabytesToBytes(5)).toBe(5_242_880);
      expect(megabytesToBytes(0.5)).toBe(524_288);
      expect(megabytesToBytes(0)).toBe(0);
    });
  });

  describe('kilobytesToMegabytes', () => {
    it('should convert kilobytes to megabytes', () => {
      expect(kilobytesToMegabytes(1024)).toBe(1);
      expect(kilobytesToMegabytes(2048)).toBe(2);
      expect(kilobytesToMegabytes(512)).toBe(0.5);
      expect(kilobytesToMegabytes(0)).toBe(0);
    });
  });

  describe('megabytesToKilobytes', () => {
    it('should convert megabytes to kilobytes', () => {
      expect(megabytesToKilobytes(1)).toBe(1024);
      expect(megabytesToKilobytes(2)).toBe(2048);
      expect(megabytesToKilobytes(0.5)).toBe(512);
      expect(megabytesToKilobytes(0)).toBe(0);
    });
  });
});

describe('Time Conversion Utilities', () => {
  describe('secondsToMinutes', () => {
    it('should convert seconds to minutes', () => {
      expect(secondsToMinutes(60)).toBe(1);
      expect(secondsToMinutes(120)).toBe(2);
      expect(secondsToMinutes(30)).toBe(0.5);
      expect(secondsToMinutes(0)).toBe(0);
    });
  });

  describe('minutesToSeconds', () => {
    it('should convert minutes to seconds', () => {
      expect(minutesToSeconds(1)).toBe(60);
      expect(minutesToSeconds(2)).toBe(120);
      expect(minutesToSeconds(0.5)).toBe(30);
      expect(minutesToSeconds(0)).toBe(0);
    });
  });

  describe('secondsToHours', () => {
    it('should convert seconds to hours', () => {
      expect(secondsToHours(3600)).toBe(1);
      expect(secondsToHours(7200)).toBe(2);
      expect(secondsToHours(1800)).toBe(0.5);
      expect(secondsToHours(0)).toBe(0);
    });
  });

  describe('hoursToSeconds', () => {
    it('should convert hours to seconds', () => {
      expect(hoursToSeconds(1)).toBe(3600);
      expect(hoursToSeconds(2)).toBe(7200);
      expect(hoursToSeconds(0.5)).toBe(1800);
      expect(hoursToSeconds(0)).toBe(0);
    });
  });

  describe('minutesToHours', () => {
    it('should convert minutes to hours', () => {
      expect(minutesToHours(60)).toBe(1);
      expect(minutesToHours(120)).toBe(2);
      expect(minutesToHours(30)).toBe(0.5);
      expect(minutesToHours(0)).toBe(0);
    });
  });

  describe('hoursToMinutes', () => {
    it('should convert hours to minutes', () => {
      expect(hoursToMinutes(1)).toBe(60);
      expect(hoursToMinutes(2)).toBe(120);
      expect(hoursToMinutes(0.5)).toBe(30);
      expect(hoursToMinutes(0)).toBe(0);
    });
  });

  describe('millisecondsToSeconds', () => {
    it('should convert milliseconds to seconds', () => {
      expect(millisecondsToSeconds(1000)).toBe(1);
      expect(millisecondsToSeconds(2000)).toBe(2);
      expect(millisecondsToSeconds(500)).toBe(0.5);
      expect(millisecondsToSeconds(0)).toBe(0);
    });
  });

  describe('secondsToMilliseconds', () => {
    it('should convert seconds to milliseconds', () => {
      expect(secondsToMilliseconds(1)).toBe(1000);
      expect(secondsToMilliseconds(2)).toBe(2000);
      expect(secondsToMilliseconds(0.5)).toBe(500);
      expect(secondsToMilliseconds(0)).toBe(0);
    });
  });
});

describe('bytesToFilesize', () => {
  it('should convert bytes to human-readable filesize in English', () => {
    expect(bytesToFilesize(1023, 'en-CA')).toBe('1,023\u00A0B');
    expect(bytesToFilesize(1024, 'en-CA')).toBe('1\u00A0KB');
    expect(bytesToFilesize(1_048_576, 'en-CA')).toBe('1\u00A0MB');
    expect(bytesToFilesize(1_073_741_824, 'en-CA')).toBe('1\u00A0GB');
    expect(bytesToFilesize(1_099_511_627_776, 'en-CA')).toBe('1\u00A0TB');
  });

  it('should convert bytes to human-readable filesize in French', () => {
    expect(bytesToFilesize(1023, 'fr-CA')).toBe('1\u00A0023\u00A0o');
    expect(bytesToFilesize(1024, 'fr-CA')).toBe('1\u00A0Ko');
    expect(bytesToFilesize(1_048_576, 'fr-CA')).toBe('1\u00A0Mo');
    expect(bytesToFilesize(1_073_741_824, 'fr-CA')).toBe('1\u00A0Go');
    expect(bytesToFilesize(1_099_511_627_776, 'fr-CA')).toBe('1\u00A0To');
  });
});
