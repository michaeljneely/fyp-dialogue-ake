/*
    Define ACL Permissions for the Application

    User
        - Full permissions on own account information

    Admin
        - Full permissions on own account information
        - Full permissions on corpus data

*/
export const grants = {
    user: {
        account: {
            "create:own": ["*"],
            "read:own": ["*"],
            "update:own": ["*"],
            "delete:own": ["*"]
        }
    },
    admin: {
        corpus: {
            "create:any": ["*"],
            "read:any": ["*"],
            "update:any": ["*"],
            "delete:any": ["*"]
        },
        account: {
            "create:own": ["*"],
            "read:own": ["*"],
            "update:own": ["*"],
            "delete:own": ["*"]
        }
    }
};

export type Role = "admin" | "user";
