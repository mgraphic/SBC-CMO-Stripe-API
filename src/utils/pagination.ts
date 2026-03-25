import type Stripe from 'stripe';

export interface ListQueryParams {
    limit?: string;
    starting_after?: string;
    ending_before?: string;
    [key: string]: string | string[] | undefined;
}

export function paginate<T extends { id: string }>(
    items: T[],
    params: ListQueryParams,
    url: string,
): Stripe.ApiList<T> {
    const limit = Math.min(parseInt(params.limit ?? '10', 10), 100);
    let data = [...items];

    if (params.starting_after) {
        const idx = data.findIndex((item) => item.id === params.starting_after);
        data = idx !== -1 ? data.slice(idx + 1) : [];
    } else if (params.ending_before) {
        const idx = data.findIndex((item) => item.id === params.ending_before);
        data = idx !== -1 ? data.slice(0, idx) : data;
    }

    const has_more = data.length > limit;

    return {
        object: 'list',
        data: data.slice(0, limit),
        has_more,
        url,
    };
}
