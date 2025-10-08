import { generateNearVectorQuery, generateFilterQuery, processTemplate } from '../graphqlTemplates';

const COLLECTION = 'Article';

describe('graphqlTemplates helpers', () => {
  describe('generateNearVectorQuery', () => {
    it('embeds collection name and limit', () => {
      const q = generateNearVectorQuery(COLLECTION, 5);
      expect(q).toContain(COLLECTION);
      expect(q).toContain('limit: 5');
      expect(q).toContain('nearVector');
    });
  });

  describe('generateFilterQuery', () => {
    it('contains where block and collection name', () => {
      const q = generateFilterQuery(COLLECTION, 12);
      expect(q).toContain('where:');
      expect(q).toContain(COLLECTION);
      expect(q).toContain('limit: 12');
    });
  });

  describe('processTemplate', () => {
    it('resolves predefined template names', () => {
      const q = processTemplate('Vector Search (nearVector)', COLLECTION, 8);
      expect(q).toContain(COLLECTION);
      expect(q).toContain('nearVector');
      expect(q).toContain('limit: 8');
    });

    it('handles Hybrid Search template', () => {
      const q = processTemplate('Hybrid Search', COLLECTION, 3);
      expect(q).toContain('hybrid:');
      expect(q).toContain(COLLECTION);
    });

    it('processes raw template placeholders', () => {
      const custom = '{exploreQuery}';
      const q = processTemplate(custom, COLLECTION);
      expect(q).toContain('_additional'); // explore query includes _additional block
      expect(q).toContain(COLLECTION);
    });
  });

  describe('generateSampleQuery', () => {
    const mockSchema = {
      classes: [
        {
          class: COLLECTION,
          properties: [
            { name: 'title', dataType: ['text'] },
            { name: 'likes', dataType: ['int'] },
            { name: 'location', dataType: ['geoCoordinates'] },
            { name: 'author', dataType: ['Person'] },
          ],
        },
        {
          class: 'Person',
          properties: [
            { name: 'name', dataType: ['text'] },
            { name: 'email', dataType: ['text'] },
            { name: 'phone', dataType: ['text'] },
            { name: 'gender', dataType: ['text'] },
            { name: 'age', dataType: ['int'] },
          ],
        },
      ],
    } as any;

    it('includes primitive, geo, and reference properties', () => {
      const { generateSampleQuery } = require('../graphqlTemplates');

      const q: string = generateSampleQuery(COLLECTION, [], 10, mockSchema);

      // Primitive
      expect(q).toContain('title');
      expect(q).toContain('likes');

      // Geo coordinates with nested lat/lon
      expect(q).toContain('location');
      expect(q).toContain('latitude');
      expect(q).toContain('longitude');

      // Reference block with nested Person props
      expect(q).toContain('author');
      expect(q).toContain('... on Person');
      expect(q).toContain('name');
      expect(q).toContain('email');
      expect(q).toContain('phone');
      expect(q).toContain('gender');
      expect(q).toContain('age');
      // Additional metadata always included
      expect(q).toContain('_additional');
      expect(q).toContain('id');
    });
  });
});
