export const times = (number: number, iteratee: (value: number) => any) => {
    return new Array(number).fill(0).map(value => iteratee(value));
};
