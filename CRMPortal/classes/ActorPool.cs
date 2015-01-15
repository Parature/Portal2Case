using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Linq;
using System.Web;

namespace Portal2Case.classes
{
    /// <summary>
    /// Pool of "Actors" who can perform tasks
    /// </summary>
    /// <typeparam name="T"></typeparam>
    public class ActorPool<T>
    {
        private readonly BlockingCollection<T> _actors;
        
        /// <summary>
        /// 
        /// </summary>
        /// <param name="poolSize">Size of the pool of actors</param>
        /// <param name="instantiator">Function to instantiate and configure each actor</param>
        public ActorPool(int poolSize, Func<T> instantiator)
        {
            _actors = new BlockingCollection<T>();

            for (var i = 0; i < poolSize; ++i)
            {
                //run the instantiating function for this pool of actors
                _actors.Add(instantiator());
            }
        }

        /// <summary>
        /// //Wrapper for situations where the task doesn't need to return anything
        /// </summary>
        /// <param name="task">Function which has the actor injected in. Performs the actual "work"</param>
        public void Perform(Action<T> task)
        {
            Perform(new Func<T, object>(res => { task(res); return null; }));
        }

        /// <summary>
        /// //Wrapper for situations where the task doesn't need to return anything
        /// </summary>
        /// <param name="task">Function which has the actor injected in. Performs the actual "work"</param>
        /// <param name="timeoutMs">Timeout in Milliseconds to wait to pull from the pool. Does not include time spent waiting for the action to complete</param>
        public void Perform(int timeoutMs, Action<T> task)
        {
            Perform(timeoutMs, new Func<T, object>(res => { task(res); return null; }));
        }

        /// <summary>
        /// 
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="task">Function which has the actor injected in. Performs the actual "work"</param>
        /// <returns></returns>
        public TResult Perform<TResult>(Func<T, TResult> task)
        {
            //Wait forever for the pool to free up
            return Perform(-1, task);
        }

        /// <summary>
        /// 
        /// </summary>
        /// <typeparam name="TResult"></typeparam>
        /// <param name="timeoutMs">Timeout in Milliseconds to wait to pull from the pool. Does not include time spent waiting for the action to complete</param>
        /// <param name="task">Function which has the actor injected in. Performs the actual "work"</param>
        /// <returns></returns>
        /// <exception cref="TimeoutException">Took longer than the timeoutMs to retrieve the actor from the pool</exception>
        public TResult Perform<TResult>(int timeoutMs, Func<T, TResult> task)
        {
            //instantiate the default object for this task
            T actor = default(T);

            //run in a try/finally similar to Locks
            //This ensures we don't lose any actors
            try
            {
                // Attempt to retrieve the actor 
                if (!_actors.TryTake(out actor, timeoutMs))
                {
                    throw new TimeoutException("Unable to acquire resource");
                }

                // Injecting the actor into the task function, where the work is actually performed
                return task(actor);
            }
            finally
            {
                // put it back in the queue if we managed to get one
                if (actor != null)
                {
                    _actors.Add(actor);
                }
            }
        }
    }
}