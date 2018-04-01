export interface KeywordSearch {
    _declaration: {
        _attributes: {
            version: string,
            encoding: string
        }
    };
    ArrayOfResult: {
        _attributes: any;
        Result: Array<DBpediaResult>;
    };
}

export interface DBpediaResult {
    Label: XMLNode;
    URI: XMLNode;
    Description: XMLNode;
    Classes: {
        Class: Array<DBpediaClass>;
    };
    Categories: {
        Category: Array<DBpediaCategory>;
    };
    Templates: any;
    Redirects: any;
    Refcount: XMLNode;
}

export interface DBpediaClass {
    Label: XMLNode;
    URI: XMLNode;
}

export interface DBpediaCategory {
    Label: XMLNode;
    URI: XMLNode;
}

export interface XMLNode {
    _text: string;
}