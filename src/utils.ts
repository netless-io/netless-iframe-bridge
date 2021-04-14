export const times = <T>(number: number, iteratee: (value: number) => T) => {
    return new Array(number).fill(0).map((_, index) => iteratee(index));
};
