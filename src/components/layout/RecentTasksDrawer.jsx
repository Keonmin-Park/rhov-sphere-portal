import React from 'react';
import { useCluster } from '../../context/ClusterContext';
import { 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  ChevronUp, 
  ChevronDown, 
  Copy, 
  RotateCw,
  Clock,
  ListTodo
} from 'lucide-react';

export default function RecentTasksDrawer() {
  const { 
    tasks, 
    isTasksOpen, 
    setIsTasksOpen, 
    updateTask, 
    showToast 
  } = useCluster();

  const handleCopyError = (task) => {
    const errorText = `[Task Error Report]\n작업: ${task.name}\n대상: ${task.target}\n시작시간: ${task.startTime}\n에러내용: ${task.error || '알 수 없는 비정상 종료'}`;
    navigator.clipboard.writeText(errorText);
    showToast('작업 에러 로그가 클립보드에 복사되었습니다.', 'info');
  };

  const handleRetryTask = (task) => {
    showToast(`'${task.name}' 작업을 재시도합니다...`, 'info');
    updateTask(task.id, {
      status: 'In-Progress',
      progress: 25,
      error: null
    });

    // Simulate async recovery pipeline
    setTimeout(() => {
      updateTask(task.id, { progress: 65 });
    }, 1200);

    setTimeout(() => {
      updateTask(task.id, {
        progress: 100,
        status: 'Completed',
        error: null
      });
      showToast(`'${task.name}' 작업이 성공적으로 완료되었습니다.`, 'success');
    }, 2500);
  };

  const inProgressCount = tasks.filter(t => t.status === 'In-Progress').length;

  return (
    <div className={`vsphere-recent-tasks-drawer ${isTasksOpen ? 'expanded' : 'collapsed'}`}>
      {/* 1. Drawer Header Bar */}
      <div 
        className="tasks-drawer-header"
        onClick={() => setIsTasksOpen(prev => !prev)}
      >
        <div className="header-title-area">
          <ListTodo size={15} className="header-icon" />
          <span className="header-title">최근 작업 (Recent Tasks)</span>
          {inProgressCount > 0 && (
            <span className="task-count-badge pulse">
              <Loader2 size={11} className="spin-icon" />
              <span>{inProgressCount} 진행 중</span>
            </span>
          )}
          <span className="task-total-count">총 {tasks.length}개</span>
        </div>

        <div className="header-control-area">
          <button 
            type="button" 
            className="drawer-toggle-btn" 
            title={isTasksOpen ? '작업 창 접기' : '작업 창 펼치기'}
          >
            {isTasksOpen ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
          </button>
        </div>
      </div>

      {/* 2. Tasks Table Content */}
      {isTasksOpen && (
        <div className="tasks-table-container">
          <table className="tasks-table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>작업 이름 (Task)</th>
                <th style={{ width: '16%' }}>대상 (Target)</th>
                <th style={{ width: '10%' }}>시작 시간</th>
                <th style={{ width: '22%' }}>진행률 (Progress)</th>
                <th style={{ width: '12%' }}>상태 (Status)</th>
                <th style={{ width: '10%' }}>수행자</th>
                <th style={{ width: '8%' }}>액션</th>
              </tr>
            </thead>
            <tbody>
              {tasks.length === 0 ? (
                <tr>
                  <td colSpan={7} className="no-tasks-cell">
                    <Clock size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    최근 실행된 작업 이력이 없습니다.
                  </td>
                </tr>
              ) : (
                tasks.map(task => {
                  const isInProgress = task.status === 'In-Progress';
                  const isCompleted = task.status === 'Completed';
                  const isFailed = task.status === 'Failed';

                  return (
                    <tr key={task.id} className={`task-row ${task.status.toLowerCase()}`}>
                      {/* Task Name */}
                      <td className="task-name-cell">
                        <span className="task-name-text">{task.name}</span>
                      </td>

                      {/* Target */}
                      <td className="task-target-cell">
                        <span className="target-pill">{task.target}</span>
                      </td>

                      {/* Start Time */}
                      <td className="task-time-cell">{task.startTime}</td>

                      {/* Progress Bar */}
                      <td className="task-progress-cell">
                        <div className="progress-bar-wrapper">
                          <div 
                            className={`progress-bar-fill ${task.status.toLowerCase()}`}
                            style={{ width: `${Math.min(100, Math.max(0, task.progress))}%` }}
                          />
                        </div>
                        <span className="progress-text">{task.progress}%</span>
                      </td>

                      {/* Status */}
                      <td className="task-status-cell">
                        {isInProgress && (
                          <span className="status-badge in-progress">
                            <Loader2 size={12} className="spin-icon" />
                            <span>진행 중</span>
                          </span>
                        )}
                        {isCompleted && (
                          <span className="status-badge completed">
                            <CheckCircle2 size={12} />
                            <span>완료</span>
                          </span>
                        )}
                        {isFailed && (
                          <span className="status-badge failed" title={task.error || '에러 발생'}>
                            <AlertCircle size={12} />
                            <span>실패</span>
                          </span>
                        )}
                      </td>

                      {/* Initiator */}
                      <td className="task-initiator-cell">{task.initiator}</td>

                      {/* Actions */}
                      <td className="task-actions-cell">
                        {isFailed ? (
                          <div className="action-buttons">
                            <button 
                              className="task-action-btn" 
                              onClick={() => handleCopyError(task)}
                              title="에러 로그 복사"
                            >
                              <Copy size={13} />
                            </button>
                            <button 
                              className="task-action-btn retry" 
                              onClick={() => handleRetryTask(task)}
                              title="작업 재시도"
                            >
                              <RotateCw size={13} />
                            </button>
                          </div>
                        ) : (
                          <span className="action-dash">-</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
