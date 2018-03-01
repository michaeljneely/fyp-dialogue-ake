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
        }
    }
};

export type Role = "admin" | "user";