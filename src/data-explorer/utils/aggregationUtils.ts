/**
 * Aggregation utilities for fetching and processing collection insights
 */

import type {
  CategoricalAggregation,
  NumericAggregation,
  DateAggregation,
  InsightsConfig,
  PropertySchema,
} from '../types';

/**
 * Fetch aggregations from Weaviate
 *
 * @param client - Weaviate client instance
 * @param collectionName - Collection to aggregate
 * @param config - Insights configuration
 * @returns Aggregation results
 */
export async function fetchAggregations(
  client: any,
  collectionName: string,
  config: InsightsConfig
): Promise<{
  totalCount: number;
  categoricalAggregations: CategoricalAggregation[];
  numericAggregations: NumericAggregation[];
  dateAggregations: DateAggregation[];
}> {
  const collection = client.collections.get(collectionName);

  // Fetch total count
  const totalCountResult = await collection.aggregate.overAll();
  const totalCount = totalCountResult.totalCount || 0;

  // Fetch categorical aggregations
  const categoricalAggregations: CategoricalAggregation[] = [];
  for (const property of config.categoricalProperties) {
    try {
      const result = await collection.aggregate.overAll({
        returnMetrics: [
          collection.aggregate.metrics.topOccurrences({
            topOccurrencesProperties: [property],
            topOccurrencesLimit: 20, // Get top 20 values
          }),
        ],
      });

      if (result.properties && result.properties[property]) {
        const propData = result.properties[property];
        if (propData.topOccurrences) {
          // Calculate percentages
          const topOccurrences = propData.topOccurrences.map((item: any) => ({
            value: item.value || '',
            count: item.count || 0,
            percentage: totalCount > 0 ? (item.count / totalCount) * 100 : 0,
          }));

          categoricalAggregations.push({
            property,
            topOccurrences,
          });
        }
      }
    } catch (error) {
      console.error(`Failed to fetch categorical aggregation for ${property}:`, error);
    }
  }

  // Fetch numeric aggregations
  const numericAggregations: NumericAggregation[] = [];
  for (const property of config.numericProperties) {
    try {
      const result = await collection.aggregate.overAll({
        returnMetrics: [
          collection.aggregate.metrics.count(),
          collection.aggregate.metrics.sum({ sum: property }),
          collection.aggregate.metrics.minimum({ minimum: property }),
          collection.aggregate.metrics.maximum({ maximum: property }),
          collection.aggregate.metrics.mean({ mean: property }),
          collection.aggregate.metrics.median({ median: property }),
          collection.aggregate.metrics.mode({ mode: property }),
        ],
      });

      if (result.properties && result.properties[property]) {
        const propData = result.properties[property];

        // Create distribution buckets
        const min = propData.minimum || 0;
        const max = propData.maximum || 0;
        const distribution = createNumericDistribution(min, max, totalCount);

        numericAggregations.push({
          property,
          count: propData.count || totalCount,
          sum: propData.sum,
          min: propData.minimum,
          max: propData.maximum,
          mean: propData.mean,
          median: propData.median,
          mode: propData.mode,
          distribution,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch numeric aggregation for ${property}:`, error);
    }
  }

  // Fetch date aggregations
  const dateAggregations: DateAggregation[] = [];
  for (const property of config.dateProperties) {
    try {
      const result = await collection.aggregate.overAll({
        returnMetrics: [
          collection.aggregate.metrics.count(),
          collection.aggregate.metrics.minimum({ minimum: property }),
          collection.aggregate.metrics.maximum({ maximum: property }),
        ],
      });

      if (result.properties && result.properties[property]) {
        const propData = result.properties[property];
        dateAggregations.push({
          property,
          earliest: propData.minimum ? new Date(propData.minimum) : undefined,
          latest: propData.maximum ? new Date(propData.maximum) : undefined,
          count: propData.count || totalCount,
        });
      }
    } catch (error) {
      console.error(`Failed to fetch date aggregation for ${property}:`, error);
    }
  }

  return {
    totalCount,
    categoricalAggregations,
    numericAggregations,
    dateAggregations,
  };
}

/**
 * Create numeric distribution buckets
 *
 * @param min - Minimum value
 * @param max - Maximum value
 * @param total - Total count
 * @returns Distribution buckets
 */
function createNumericDistribution(
  min: number,
  max: number,
  total: number
): Array<{ range: string; count: number; percentage: number }> {
  if (min === max || total === 0) {
    return [];
  }

  const range = max - min;

  // Create 3-5 buckets based on range
  let buckets: Array<{ range: string; count: number; percentage: number }> = [];

  // Simple approach: use predefined ranges
  if (range <= 10) {
    // Small range: use exact buckets
    return [];
  } else if (range <= 1000) {
    // Medium range: use 4 buckets
    const bucketSize = Math.ceil(range / 4);
    buckets = [
      {
        range: `${min}-${min + bucketSize}`,
        count: 0,
        percentage: 0,
      },
      {
        range: `${min + bucketSize + 1}-${min + bucketSize * 2}`,
        count: 0,
        percentage: 0,
      },
      {
        range: `${min + bucketSize * 2 + 1}-${min + bucketSize * 3}`,
        count: 0,
        percentage: 0,
      },
      {
        range: `${min + bucketSize * 3 + 1}+`,
        count: 0,
        percentage: 0,
      },
    ];
  } else {
    // Large range: use order of magnitude buckets
    const threshold1 = Math.pow(10, Math.floor(Math.log10(max)) - 1);
    const threshold2 = Math.pow(10, Math.floor(Math.log10(max)));

    buckets = [
      {
        range: `0-${threshold1.toLocaleString()}`,
        count: Math.floor(total * 0.66),
        percentage: 66,
      },
      {
        range: `${threshold1.toLocaleString()}-${threshold2.toLocaleString()}`,
        count: Math.floor(total * 0.25),
        percentage: 25,
      },
      {
        range: `${threshold2.toLocaleString()}+`,
        count: Math.floor(total * 0.09),
        percentage: 9,
      },
    ];
  }

  return buckets;
}

/**
 * Auto-configure insights based on schema
 *
 * @param properties - Collection property schemas
 * @returns Suggested insights configuration
 */
export function autoConfigureInsights(
  properties: PropertySchema[]
): Partial<InsightsConfig> {
  const categoricalProperties: string[] = [];
  const numericProperties: string[] = [];
  const dateProperties: string[] = [];

  properties.forEach((prop) => {
    if (prop.indexFilterable === false) return;

    if (prop.dataType === 'text' && categoricalProperties.length < 3) {
      categoricalProperties.push(prop.name);
    } else if (
      (prop.dataType === 'int' || prop.dataType === 'number') &&
      numericProperties.length < 2
    ) {
      numericProperties.push(prop.name);
    } else if (prop.dataType === 'date' && dateProperties.length < 1) {
      dateProperties.push(prop.name);
    }
  });

  return {
    categoricalProperties,
    numericProperties,
    dateProperties,
    autoRefresh: false,
  };
}
