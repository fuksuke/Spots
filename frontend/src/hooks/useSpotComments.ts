import useSWRInfinite from "swr/infinite";
import { CommentListResponse } from "../types";

const PAGE_SIZE = 20;

const fetcher = async ([endpoint, token]: [string, string | null]) => {
  const res = await fetch(endpoint, {
    headers: token
      ? {
          Authorization: `Bearer ${token}`
        }
      : undefined
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch comments: ${res.status}`);
  }
  return (await res.json()) as CommentListResponse;
};

export const useSpotComments = (spotId?: string, authToken?: string) => {
  const getKey = (pageIndex: number, previousPageData: CommentListResponse | null) => {
    if (!spotId) return null;
    if (previousPageData && !previousPageData.nextCursor) {
      return null;
    }

    const search = new URLSearchParams();
    search.set("limit", PAGE_SIZE.toString());
    if (pageIndex > 0 && previousPageData?.nextCursor) {
      search.set("cursor", previousPageData.nextCursor);
    }

    const token = authToken?.trim() ? authToken.trim() : null;
    return [`/api/spots/${spotId}/comments?${search.toString()}`, token] as [string, string | null];
  };

  const { data, error, isValidating, size, setSize, mutate } = useSWRInfinite<CommentListResponse>(getKey, fetcher, {
    revalidateOnFocus: false
  });

  const comments = data ? data.flatMap((page) => page.comments) : [];
  const isLoadingInitialData = !data && !error;
  const hasUndefinedPage = size > 0 && Array.isArray(data) && data[size - 1] === undefined;
  const isLoadingMore = isLoadingInitialData || hasUndefinedPage;
  const lastPage = Array.isArray(data) && data.length > 0 ? data[data.length - 1] : null;
  const hasMore = lastPage?.nextCursor != null;

  const loadMore = () => {
    if (!hasMore) return Promise.resolve();
    return setSize(size + 1);
  };

  return {
    comments,
    error,
    isLoading: isLoadingInitialData,
    isLoadingMore,
    hasMore,
    loadMore,
    mutate,
    isValidating
  };
};
