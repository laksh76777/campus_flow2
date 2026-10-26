export const getParam = (param: string | string[] | undefined, defaultVal: string = ""): string => {
    if (Array.isArray(param)) return param[0] || defaultVal;
    return param || defaultVal;
};
