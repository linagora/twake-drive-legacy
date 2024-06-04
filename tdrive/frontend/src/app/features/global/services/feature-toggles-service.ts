/* eslint-disable @typescript-eslint/no-explicit-any */
// Define feature names here
export enum FeatureNames {
  GUESTS = 'chat:guests',
  MESSAGE_HISTORY = 'chat:message_history',
  MESSAGE_HISTORY_LIMIT = 'chat:message_history_limit',
  MULTIPLE_WORKSPACES = 'chat:multiple_workspaces',
  EDIT_FILES = 'chat:edit_files',
  UNLIMITED_STORAGE = 'chat:unlimited_storage', //Currently inactive
  COMPANY_INVITE_MEMBER = 'company:invite_member',
  COMPANY_SEARCH_USERS = 'company:search_users',
  COMPANY_SHARED_DRIVE = 'company:shared_drive',
  COMPANY_DISPLAY_EMAIL = 'company:display_email',
  COMPANY_USER_QUOTA = 'company:user_quota',
}

export type FeatureValueType = boolean | number;

const availableFeaturesWithDefaults = new Map<FeatureNames, any>();

// Define available features with defaults here
availableFeaturesWithDefaults.set(FeatureNames.GUESTS, true);
availableFeaturesWithDefaults.set(FeatureNames.MESSAGE_HISTORY, true);
availableFeaturesWithDefaults.set(FeatureNames.MESSAGE_HISTORY_LIMIT, 10000);
availableFeaturesWithDefaults.set(FeatureNames.MULTIPLE_WORKSPACES, true);
availableFeaturesWithDefaults.set(FeatureNames.EDIT_FILES, true);
availableFeaturesWithDefaults.set(FeatureNames.UNLIMITED_STORAGE, true);
availableFeaturesWithDefaults.set(FeatureNames.COMPANY_INVITE_MEMBER, true);
availableFeaturesWithDefaults.set(FeatureNames.COMPANY_INVITE_MEMBER, true);
availableFeaturesWithDefaults.set(FeatureNames.COMPANY_SEARCH_USERS, true);
availableFeaturesWithDefaults.set(FeatureNames.COMPANY_SHARED_DRIVE, true);
availableFeaturesWithDefaults.set(FeatureNames.COMPANY_DISPLAY_EMAIL, true);
availableFeaturesWithDefaults.set(FeatureNames.COMPANY_USER_QUOTA, false);

/**
 * ChannelServiceImpl that allow you to manage feature flipping in Tdrive using react feature toggles
 */
class FeatureTogglesService {
  public activeFeatureNames: FeatureNames[];
  private activeFeatureValues: Map<FeatureNames, FeatureValueType>;

  constructor() {
    (window as any).FeatureTogglesService = this;
    this.activeFeatureNames = [];
    this.activeFeatureValues = new Map<FeatureNames, FeatureValueType>();

    // We need to set with default features
    this.setFeaturesFromCompanyPlan({
      features: {},
    });
  }

  public setFeaturesFromCompanyPlan(plan: { features: { [key: string]: FeatureValueType } }): void {
    for (const [featureName, defaultValue] of availableFeaturesWithDefaults) {
      this.setActiveFeatureName(
        featureName,
        plan.features[featureName] !== undefined ? plan.features[featureName] : defaultValue,
      );
    }
  }

  private setActiveFeatureName(featureName: FeatureNames, value: FeatureValueType): void {
    if (typeof value === 'boolean') {
      this.activeFeatureNames = this.activeFeatureNames.filter(name => name !== featureName);
      if (value) this.activeFeatureNames.push(featureName);
      this.activeFeatureValues.set(featureName, value);
    } else {
      this.activeFeatureValues.set(featureName, value);
    }
  }

  public isActiveFeatureName(featureName: FeatureNames) {
    return this.activeFeatureNames.includes(featureName);
  }

  public getFeatureValue<T>(featureName: FeatureNames): T {
    return this.activeFeatureValues.get(featureName) as unknown as T;
  }
}

export default new FeatureTogglesService();
