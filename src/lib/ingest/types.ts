export type ParsedEvent = {
  sourceId?: string;
  title: string;
  description?: string;
  startTime: Date;
  endTime?: Date;
  locationText?: string;
  organizer?: string;
  category?: string;
  isCLE?: boolean;
  latitude?: number;
  longitude?: number;
};
