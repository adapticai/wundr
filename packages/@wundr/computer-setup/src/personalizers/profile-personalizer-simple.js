"use strict";
/**
 * Simple Profile Personalizer - Basic implementation without optional dependencies
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProfilePersonalizerSimple = void 0;
class ProfilePersonalizerSimple {
    config;
    constructor(config) {
        this.config = config;
    }
    async personalize() {
        console.log(`🎨 Personalizing profile for ${this.config.fullName}...`);
        // Basic personalization without complex dependencies
        await this.setupGitConfig();
        await this.createDirectories();
        console.log('✅ Basic profile personalization completed');
    }
    async setupGitConfig() {
        try {
            const { execa } = await Promise.resolve().then(() => __importStar(require('execa')));
            await execa('git', ['config', '--global', 'user.name', this.config.fullName]);
            if (this.config.email) {
                await execa('git', ['config', '--global', 'user.email', this.config.email]);
            }
            console.log('✅ Git configuration updated');
        }
        catch (error) {
            console.warn('⚠️  Could not configure Git:', error.message);
        }
    }
    async createDirectories() {
        try {
            const { promises: fs } = await Promise.resolve().then(() => __importStar(require('fs')));
            const os = await Promise.resolve().then(() => __importStar(require('os')));
            const path = await Promise.resolve().then(() => __importStar(require('path')));
            const homeDir = os.homedir();
            const devDir = path.join(homeDir, 'Development');
            const directories = [
                devDir,
                path.join(devDir, 'projects'),
                path.join(devDir, 'tools'),
                path.join(devDir, 'sandbox')
            ];
            for (const dir of directories) {
                await fs.mkdir(dir, { recursive: true });
            }
            console.log('✅ Development directories created');
        }
        catch (error) {
            console.warn('⚠️  Could not create directories:', error.message);
        }
    }
}
exports.ProfilePersonalizerSimple = ProfilePersonalizerSimple;
//# sourceMappingURL=profile-personalizer-simple.js.map