import { z } from 'zod';

const exactNonblankString = z.string().refine((value) => value.trim().length > 0, {
  message: 'Must contain non-whitespace characters',
});

export const lockIdSchema = exactNonblankString;
export const pagePathSchema = exactNonblankString;
export const domPathSchema = exactNonblankString;
