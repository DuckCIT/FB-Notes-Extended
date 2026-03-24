export interface ProcessedNote {
  fullDescription: string;
}

export const processNoteInput = (input: string): ProcessedNote => {
  return {
    fullDescription: input,
  };
};
