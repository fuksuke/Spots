export type RecordSpotViewParams = {
  spotId: string;
  sessionId: string;
  authToken?: string;
};

export const recordSpotView = async ({ spotId, sessionId, authToken }: RecordSpotViewParams) => {
  try {
    const response = await fetch(`/api/spots/${spotId}/view`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {})
      },
      body: JSON.stringify({ sessionId })
    });

    if (!response.ok) {
      const message = await response.text().catch(() => null);
      throw new Error(message || `Failed to record spot view (${response.status})`);
    }

    return response
      .json()
      .catch(() => ({ recorded: false, viewCount: null })) as Promise<{ recorded: boolean; viewCount: number | null }>;
  } catch (error) {
    if (import.meta.env.DEV) {
      console.warn("recordSpotView failed", error);
    }
    throw error;
  }
};
