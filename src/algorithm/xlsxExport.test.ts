import { describe, expect, it } from 'vitest';
import { createFeretMeasurementsXlsx, createMeasurementWorkbookFilename } from './xlsxExport';
import type { SavedAnnotation } from './polygonEditing';

describe('xlsx export utilities', () => {
  it('creates an XLSX workbook blob with Feret-only measurement headers', async () => {
    const row: SavedAnnotation = {
      id: 1,
      center: { x: 5, y: 5 },
      areaPixels: 40,
      feretAveragePixels: 7.38,
      feretMinPixels: 4,
      feretMaxPixels: 10.77,
      vertexCount: 4,
      excludedCount: 0,
      visible: true,
      displayPoints: [],
      editedRadii: {},
      editedPointPositions: {},
      manualExcludedIndices: [],
      rayCount: 32,
      threshold: 24,
      maxRadius: 120,
      stepSize: 0.5,
      outlierThreshold: 35,
    };

    const blob = createFeretMeasurementsXlsx([row], 2.2);
    const text = new TextDecoder().decode(await blob.arrayBuffer());

    expect(blob.type).toBe('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    expect(text.startsWith('PK')).toBe(true);
    expect(text).toContain('Avg Feret (um)');
    expect(text).toContain('Min Feret (um)');
    expect(text).toContain('Feret max (um)');
    expect(text).toContain('16.24');
    expect(text).toContain('8.8');
    expect(text).toContain('23.69');
  });

  it('formats measurement downloads with timestamp and image filename', () => {
    const filename = createMeasurementWorkbookFilename('cell sample 01.png', new Date(2026, 5, 11, 17, 8, 9));

    expect(filename).toBe('2026-06-11_17-08-09_cell_sample_01.xlsx');
  });
});
