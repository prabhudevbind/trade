import Contest from '../models/Contest';

// ...existing code...

async checkExistingContest(userId: string, contestId: string): Promise<{ canJoin: boolean, message: string }> {
  try {
    // Get current date
    const currentDate = new Date();

    // Find any ongoing contests where user has already joined
    const existingContest = await Contest.findOne({
      _id: { $ne: contestId },
      'participants.userId': userId,
      endDate: { $gt: currentDate },
      status: 'active'
    });

    if (existingContest) {
      return {
        canJoin: false,
        message: 'You are already participating in an ongoing contest'
      };
    }

    return {
      canJoin: true,
      message: 'User can join the contest'
    };
  } catch (error) {
    throw new Error('Error checking existing contests');
  }
}

async joinContest(userId: string, contestId: string): Promise<any> {
  try {
    // Check existing contests first
    const check = await this.checkExistingContest(userId, contestId);
    if (!check.canJoin) {
      return {
        success: false,
        message: check.message
      };
    }

    // Continue with existing join contest logic
    // ...existing code...
  } catch (error) {
    throw new Error('Error joining contest');
  }
}

// ...existing code...