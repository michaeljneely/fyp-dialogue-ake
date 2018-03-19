declare module "rouge" {
    export function n(candidate: string, reference: string, options: any): number;
    export function l(candidate: string, reference: string, options: any): number;
    export function s(candidate: string, reference: string, options: any): number;

}